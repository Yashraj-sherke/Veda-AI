import { NextResponse } from "next/server";
import { analyzeAssessment } from "@/lib/ai/analyze";
import { GeminiProvider } from "@/lib/ai/gemini";
import type { AssessmentAIProvider, DocumentInput } from "@/lib/ai/provider";
import { XaiProvider } from "@/lib/ai/xai";
import { createDemoAssessment } from "@/data/demo-assessment";
import { ACCEPTED_TYPES, MAX_DOCUMENT_BYTES, MAX_FILE_BYTES } from "@/lib/document/files";
import type { AnalysisProgress, AssessmentResult } from "@/types/assessment";

export const runtime = "nodejs";
export const maxDuration = 300;

async function prepareDocument(files: File[]): Promise<{ input: DocumentInput; pageCount: number }> {
  const sources = await Promise.all(
    files.map(async (file) => ({ file, buffer: await file.arrayBuffer() })),
  );
  const isPdf = files.length === 1 && files[0].type === "application/pdf";
  const pageCount = isPdf
    ? Math.max(
        1,
        new TextDecoder("latin1")
          .decode(sources[0].buffer)
          .match(/\/Type\s*\/Page\b/g)?.length ?? 1,
      )
    : files.length;

  return {
    input: {
      parts: sources.map(({ file, buffer }) => ({
        name: file.name,
        mimeType: file.type,
        base64: Buffer.from(buffer).toString("base64"),
      })),
    },
    pageCount,
  };
}

function validateDocument(files: File[], label: string) {
  if (!files.length) return `${label} is required.`;
  if (files.some((file) => !ACCEPTED_TYPES.includes(file.type as (typeof ACCEPTED_TYPES)[number]))) {
    return `${label} must be a PDF, PNG, JPG, or JPEG.`;
  }
  if (files.some((file) => file.size > MAX_FILE_BYTES)) return `Each ${label.toLowerCase()} file must be 2 MB or smaller.`;
  if (files.reduce((sum, file) => sum + file.size, 0) > MAX_DOCUMENT_BYTES) return `${label} must be 2 MB or smaller in total.`;
  return null;
}

function normalizeProcessError(error: unknown) {
  const rawMessage = error instanceof Error ? error.message : "The assessment could not be processed.";
  const providerUnavailable = /rate|quota|429|high demand|overloaded|temporar(?:ily|y)|unavailable|503/i.test(rawMessage);
  const message = providerUnavailable
    ? "The AI service is temporarily busy after trying the available models. Try again shortly or explore Demo Mode."
    : /timeout|aborted/i.test(rawMessage)
      ? "Document analysis took too long. Try a smaller file or retry in a moment."
      : rawMessage;
  return { message, status: providerUnavailable ? 503 : 500 };
}

type ProcessStreamEvent =
  | { type: "progress"; progress: AnalysisProgress }
  | { type: "result"; result: AssessmentResult }
  | { type: "error"; error: string };

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const isDemo = formData.get("demo") === "true";
    const questionFiles = formData.getAll("questionPaper").filter((value): value is File => value instanceof File);
    const answerFiles = formData.getAll("answerSheet").filter((value): value is File => value instanceof File);

    if (isDemo) return NextResponse.json(createDemoAssessment());

    const questionError = validateDocument(questionFiles, "Question paper");
    const answerError = validateDocument(answerFiles, "Answer sheet");
    if (questionError || answerError) {
      return NextResponse.json({ error: questionError || answerError }, { status: 400 });
    }

    const providerName = (process.env.AI_PROVIDER || "gemini").toLowerCase();
    let provider: AssessmentAIProvider;
    if (providerName === "xai") {
      const apiKey = process.env.XAI_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          { error: "Live analysis is configured for xAI, but XAI_API_KEY is missing." },
          { status: 503 },
        );
      }
      provider = new XaiProvider(apiKey);
    } else {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          { error: "Live analysis is configured for Gemini, but GEMINI_API_KEY is missing." },
          { status: 503 },
        );
      }
      provider = new GeminiProvider(apiKey);
    }
    const [questionPaper, answerSheet] = await Promise.all([
      prepareDocument(questionFiles),
      prepareDocument(answerFiles),
    ]);
    const encoder = new TextEncoder();
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      cancel() {
        cancelled = true;
      },
      start(controller) {
        const send = (event: ProcessStreamEvent) => {
          if (!cancelled) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        };

        void (async () => {
          try {
            const result = await analyzeAssessment({
              provider,
              questionPaper: questionPaper.input,
              answerSheet: answerSheet.input,
              questionPaperName: questionFiles.length === 1 ? questionFiles[0].name : `${questionFiles.length} question-paper images`,
              answerSheetName: answerFiles.length === 1 ? answerFiles[0].name : `${answerFiles.length} answer-sheet images`,
              questionPaperPageCount: questionPaper.pageCount,
              answerSheetPageCount: answerSheet.pageCount,
              onProgress: (progress) => send({ type: "progress", progress }),
            });
            send({ type: "result", result });
          } catch (error) {
            send({ type: "error", error: normalizeProcessError(error).message });
          } finally {
            if (!cancelled) controller.close();
          }
        })();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (error) {
    const normalized = normalizeProcessError(error);
    return NextResponse.json({ error: normalized.message }, { status: normalized.status });
  }
}
