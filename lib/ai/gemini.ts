import { clampBoundingBox } from "@/lib/mapping/bounds";
import type { AnswerMapping, ExtractedAnswer } from "@/types/assessment";
import type {
  AssessmentAIProvider,
  DocumentInput,
  ExtractedQuestionDraft,
  MappingGradeDecision,
} from "./provider";
import { ANSWER_EXTRACTION_PROMPT, mappingPrompt, QUESTION_EXTRACTION_PROMPT } from "./prompts";
import { answerExtractionSchema, mappingGradeSchema, questionExtractionSchema } from "./schemas";
import type { z } from "zod";

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  error?: { message?: string; code?: number };
};

type UploadFileResponse = {
  file?: {
    name?: string;
    uri?: string;
    state?: string;
    mimeType?: string;
  };
};

const STABLE_FALLBACK_MODELS = [
  "gemini-3.1-flash-lite",
] as const;

const RETRYABLE_PROVIDER_STATUSES = new Set([429, 500, 502, 503, 504]);
const RETRYABLE_PROVIDER_MESSAGE = /high demand|overloaded|temporar(?:ily|y)|rate limit|quota|unavailable|try again/i;

export class GeminiProvider implements AssessmentAIProvider {
  readonly model: string;
  private readonly fileUriCache = new Map<string, string>();

  constructor(
    private readonly apiKey: string,
    model = process.env.GEMINI_MODEL || process.env.AI_MODEL || "gemini-3.6-flash",
  ) {
    this.model = model;
  }

  private async uploadLargeFile(buffer: Buffer, mimeType: string, displayName: string): Promise<string> {
    const initRes = await fetch(
      `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${this.apiKey}`,
      {
        method: "POST",
        headers: {
          "X-Goog-Upload-Protocol": "resumable",
          "X-Goog-Upload-Command": "start",
          "X-Goog-Upload-Header-Content-Length": buffer.length.toString(),
          "X-Goog-Upload-Header-Content-Type": mimeType,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          file: {
            display_name: displayName,
          },
        }),
      },
    );

    if (!initRes.ok) {
      const errText = await initRes.text();
      throw new Error(`Failed to initialize large file upload: ${errText}`);
    }

    const uploadUrl = initRes.headers.get("x-goog-upload-url");
    if (!uploadUrl) {
      throw new Error("No upload URL returned by Gemini upload API.");
    }

    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Content-Length": buffer.length.toString(),
        "X-Goog-Upload-Offset": "0",
        "X-Goog-Upload-Command": "upload, finalize",
      },
      body: new Uint8Array(buffer),
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`Failed to upload file content: ${errText}`);
    }

    const payload = (await uploadRes.json()) as UploadFileResponse;
    if (!payload.file?.uri) {
      throw new Error("Gemini upload did not return a valid file URI.");
    }

    let state = payload.file.state;
    let attempts = 0;
    while (state === "PROCESSING" && attempts < 15) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const checkRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${payload.file.name}?key=${this.apiKey}`,
      );
      if (checkRes.ok) {
        const checkData = (await checkRes.json()) as UploadFileResponse;
        state = checkData.file?.state;
        if (state === "FAILED") {
          throw new Error("Gemini large file processing failed.");
        }
      }
      attempts += 1;
    }

    return payload.file.uri;
  }

  private async prepareContentParts(document?: DocumentInput): Promise<Array<Record<string, unknown>>> {
    if (!document || !document.parts.length) return [];
    const parts: Array<Record<string, unknown>> = [];

    for (let index = 0; index < document.parts.length; index += 1) {
      const part = document.parts[index];
      if (document.parts.length > 1) {
        parts.push({ text: `Document page ${index + 1}: ${part.name}` });
      }

      // Base64 string length threshold: > 4MB (approx 5.3M chars) use File API upload
      const isLarge = part.base64.length > 5.3 * 1024 * 1024;
      if (isLarge) {
        let fileUri = this.fileUriCache.get(part.name);
        if (!fileUri) {
          const buffer = Buffer.from(part.base64, "base64");
          fileUri = await this.uploadLargeFile(buffer, part.mimeType, part.name);
          this.fileUriCache.set(part.name, fileUri);
        }
        parts.push({ fileData: { mimeType: part.mimeType, fileUri } });
      } else {
        parts.push({ inlineData: { mimeType: part.mimeType, data: part.base64 } });
      }
    }

    return parts;
  }

  private async callStructured<T>(
    prompt: string,
    schema: z.ZodType<T>,
    document?: DocumentInput,
  ): Promise<T> {
    const documentParts = await this.prepareContentParts(document);
    const parts: Array<Record<string, unknown>> = [{ text: prompt }, ...documentParts];
    const models = Array.from(new Set([this.model, ...STABLE_FALLBACK_MODELS]));
    let lastError = new Error("The AI provider could not process the document.");

    for (let modelIndex = 0; modelIndex < models.length; modelIndex += 1) {
      const model = models[modelIndex];
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": this.apiKey,
            },
            body: JSON.stringify({
              contents: [{ role: "user", parts }],
              generationConfig: {
                responseMimeType: "application/json",
              },
            }),
            signal: AbortSignal.timeout(25_000),
          },
        );

        const rawPayload = await response.text();
        let payload: GeminiResponse = {};
        try {
          payload = rawPayload ? JSON.parse(rawPayload) as GeminiResponse : {};
        } catch {
          throw new Error("The AI provider returned an invalid response. Please retry.");
        }

        if (!response.ok) {
          const message = payload.error?.message || "The AI provider could not process the document.";
          lastError = new Error(message);
          const retryable = RETRYABLE_PROVIDER_STATUSES.has(response.status)
            || RETRYABLE_PROVIDER_MESSAGE.test(message);
          if (retryable && modelIndex < models.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 400 * (modelIndex + 1)));
            continue;
          }
          throw lastError;
        }

        const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("");
        if (!text) throw new Error("The AI provider returned an empty response.");

        let parsed: unknown;
        try {
          parsed = JSON.parse(text.replace(/^```json\s*|\s*```$/g, ""));
        } catch {
          throw new Error("The AI response was not valid structured JSON. Please retry.");
        }

        const validated = schema.safeParse(parsed);
        if (!validated.success) {
          throw new Error("The AI response was incomplete or malformed. Please retry.");
        }
        return validated.data;
      } catch (error) {
        lastError = error instanceof Error ? error : lastError;
        const retryable = RETRYABLE_PROVIDER_MESSAGE.test(lastError.message)
          || lastError.name === "TimeoutError";
        if (retryable && modelIndex < models.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 400 * (modelIndex + 1)));
          continue;
        }
        throw lastError;
      }
    }

    throw lastError;
  }

  async extractQuestions(input: DocumentInput): Promise<ExtractedQuestionDraft[]> {
    const result = await this.callStructured(QUESTION_EXTRACTION_PROMPT, questionExtractionSchema, input);
    return result.questions.map((question) => ({
      ...question,
      marks: question.marks ?? undefined,
    }));
  }

  async extractAnswers(input: DocumentInput): Promise<ExtractedAnswer[]> {
    const result = await this.callStructured(ANSWER_EXTRACTION_PROMPT, answerExtractionSchema, input);
    return result.answers.map((answer, answerIndex) => {
      const regions = answer.regions.map((rawRegion, regionIndex) => ({
        id: `answer-${answerIndex + 1}-region-${regionIndex + 1}`,
        pageNumber: rawRegion.pageNumber,
        boundingBox: clampBoundingBox(rawRegion),
        confidence: rawRegion.confidence,
      }));
      const pages = regions.map((region) => region.pageNumber);
      return {
        id: `answer-${answerIndex + 1}`,
        detectedLabel: answer.detectedLabel ?? undefined,
        text: answer.text,
        regions,
        startPage: Math.min(...pages),
        endPage: Math.max(...pages),
        confidence: answer.confidence,
      };
    });
  }

  async mapAndGradeAnswers(
    questions: ExtractedQuestionDraft[],
    answers: ExtractedAnswer[],
    deterministicMappings: AnswerMapping[],
  ): Promise<MappingGradeDecision[]> {
    const result = await this.callStructured(
      mappingPrompt({ questions, answers, deterministicMappings }),
      mappingGradeSchema,
    );
    return result.decisions.map((decision) => ({
      ...decision,
      questionNumber: decision.questionNumber ?? undefined,
      score: decision.score ?? undefined,
      evaluation: decision.evaluation ?? undefined,
      feedback: decision.feedback ?? undefined,
      reasoning: decision.reasoning ?? undefined,
    }));
  }
}
