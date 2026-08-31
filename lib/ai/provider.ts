import type { AnswerMapping, ExtractedAnswer } from "@/types/assessment";

export type DocumentPart = {
  name: string;
  mimeType: string;
  base64: string;
};

export type DocumentInput = {
  parts: DocumentPart[];
};

export type ExtractedQuestionDraft = {
  originalNumber: string;
  text: string;
  pageNumber: number;
  marks?: number;
  confidence: number;
};

export type MappingGradeDecision = {
  questionNumber?: string;
  answerId: string;
  confidence: number;
  status: "mapped" | "uncertain" | "unmapped";
  score?: number;
  evaluation?: "correct" | "partially_correct" | "incorrect" | "needs_review";
  feedback?: string;
  reasoning?: string;
};

export interface AssessmentAIProvider {
  readonly model: string;
  extractQuestions(input: DocumentInput): Promise<ExtractedQuestionDraft[]>;
  extractAnswers(input: DocumentInput): Promise<ExtractedAnswer[]>;
  mapAndGradeAnswers(
    questions: ExtractedQuestionDraft[],
    answers: ExtractedAnswer[],
    deterministicMappings: AnswerMapping[],
  ): Promise<MappingGradeDecision[]>;
}
