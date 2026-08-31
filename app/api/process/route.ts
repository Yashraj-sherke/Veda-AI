import { NextResponse } from "next/server";
import { analyzeAssessment } from "@/lib/ai/analyze";
import { GeminiProvider } from "@/lib/ai/gemini";
import type { DocumentInput } from "@/lib/ai/provider";
import { createDemoAssessment } from "@/data/demo-assessment";
import { ACCEPTED_TYPES, MAX_FILE_BYTES } from "@/lib/document/files";

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
  if (files.some((file) => file.size > MAX_FILE_BYTES)) return `Each ${label.toLowerCase()} file must be 50 MB or smaller.`;
  if (files.reduce((sum, file) => sum + file.size, 0) > 100 * 1024 * 1024) return `${label} exceeds the 100 MB total size limit.`;
  return null;
}

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

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Live document analysis is not configured. Add GEMINI_API_KEY to .env.local, restart the server, or use Explore Demo.",
        },
        { status: 503 },
      );
    }

    const provider = new GeminiProvider(apiKey);
    const [questionPaper, answerSheet] = await Promise.all([
      prepareDocument(questionFiles),
      prepareDocument(answerFiles),
    ]);
    const result = await analyzeAssessment({
      provider,
      questionPaper: questionPaper.input,
      answerSheet: answerSheet.input,
      questionPaperName: questionFiles.length === 1 ? questionFiles[0].name : `${questionFiles.length} question-paper images`,
      answerSheetName: answerFiles.length === 1 ? answerFiles[0].name : `${answerFiles.length} answer-sheet images`,
      questionPaperPageCount: questionPaper.pageCount,
      answerSheetPageCount: answerSheet.pageCount,
    });
    return NextResponse.json(result);
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "The assessment could not be processed.";
    const message = /rate|quota|429/i.test(rawMessage)
      ? "The AI service is busy or its free-tier limit was reached. Try again shortly or explore Demo Mode."
      : /timeout|aborted/i.test(rawMessage)
        ? "Document analysis took too long. Try a smaller file or retry in a moment."
        : rawMessage;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
