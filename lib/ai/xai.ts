import { clampBoundingBox } from "@/lib/mapping/bounds";
import type { AnswerMapping, ExtractedAnswer } from "@/types/assessment";
import { z } from "zod";
import type {
  AssessmentAIProvider,
  DocumentInput,
  ExtractedQuestionDraft,
  MappingGradeDecision,
} from "./provider";
import { ANSWER_EXTRACTION_PROMPT, mappingPrompt, QUESTION_EXTRACTION_PROMPT } from "./prompts";
import { answerExtractionSchema, mappingGradeSchema, questionExtractionSchema } from "./schemas";

type XaiResponse = {
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
  error?: { message?: string };
};

type XaiFileResponse = {
  id?: string;
  error?: { message?: string };
};

export class XaiProvider implements AssessmentAIProvider {
  readonly model: string;

  constructor(
    private readonly apiKey: string,
    model = process.env.XAI_MODEL || "grok-4.6",
  ) {
    this.model = model;
  }

  private async uploadPdf(part: DocumentInput["parts"][number]): Promise<string> {
    const formData = new FormData();
    formData.append("expires_after", "3600");
    formData.append("purpose", "assistants");
    formData.append(
      "file",
      new Blob([new Uint8Array(Buffer.from(part.base64, "base64"))], { type: part.mimeType }),
      part.name,
    );

    const response = await fetch("https://api.x.ai/v1/files", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: formData,
      signal: AbortSignal.timeout(20_000),
    });
    const payload = await this.readJson<XaiFileResponse>(response);
    if (!response.ok || !payload.id) {
      throw new Error(payload.error?.message || "xAI could not upload the document.");
    }
    return payload.id;
  }

  private async deleteFile(fileId: string): Promise<void> {
    try {
      await fetch(`https://api.x.ai/v1/files/${encodeURIComponent(fileId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(5_000),
      });
    } catch {
      // Uploaded files also expire after one hour, so cleanup failure is non-fatal.
    }
  }

  private async readJson<T>(response: Response): Promise<T> {
    const raw = await response.text();
    try {
      return (raw ? JSON.parse(raw) : {}) as T;
    } catch {
      throw new Error(`xAI returned an invalid response (${response.status}).`);
    }
  }

  private async prepareContent(document?: DocumentInput): Promise<{
    content: Array<Record<string, unknown>>;
    uploadedFileIds: string[];
  }> {
    const content: Array<Record<string, unknown>> = [];
    const uploadedFileIds: string[] = [];
    if (!document) return { content, uploadedFileIds };

    for (let index = 0; index < document.parts.length; index += 1) {
      const part = document.parts[index];
      if (document.parts.length > 1) {
        content.push({ type: "input_text", text: `Document page ${index + 1}: ${part.name}` });
      }
      if (part.mimeType === "application/pdf") {
        const fileId = await this.uploadPdf(part);
        uploadedFileIds.push(fileId);
        content.push({ type: "input_file", file_id: fileId });
      } else {
        content.push({
          type: "input_image",
          image_url: `data:${part.mimeType};base64,${part.base64}`,
        });
      }
    }
    return { content, uploadedFileIds };
  }

  private async callStructured<T>(
    prompt: string,
    schema: z.ZodType<T>,
    document?: DocumentInput,
  ): Promise<T> {
    const { content, uploadedFileIds } = await this.prepareContent(document);
    try {
      const response = await fetch("https://api.x.ai/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          input: [{
            role: "user",
            content: [{ type: "input_text", text: prompt }, ...content],
          }],
          reasoning: { effort: "low" },
          text: {
            format: {
              type: "json_schema",
              name: "assessment_response",
              schema: z.toJSONSchema(schema),
              strict: true,
            },
          },
        }),
        signal: AbortSignal.timeout(45_000),
      });

      const payload = await this.readJson<XaiResponse>(response);
      if (!response.ok) {
        throw new Error(payload.error?.message || "xAI could not process the document.");
      }
      const text = payload.output
        ?.flatMap((item) => item.content || [])
        .find((item) => item.type === "output_text")
        ?.text;
      if (!text) throw new Error("xAI returned an empty response.");

      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error("The xAI response was not valid structured JSON. Please retry.");
      }
      const validated = schema.safeParse(parsed);
      if (!validated.success) {
        throw new Error("The xAI response was incomplete or malformed. Please retry.");
      }
      return validated.data;
    } finally {
      await Promise.allSettled(uploadedFileIds.map((fileId) => this.deleteFile(fileId)));
    }
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
