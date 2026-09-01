export type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type AnswerRegion = {
  id: string;
  pageNumber: number;
  boundingBox: BoundingBox;
  confidence: number;
};

export type QuestionStatus =
  | "answered"
  | "partially_answered"
  | "unanswered"
  | "needs_review";

export type EvaluationState =
  | "correct"
  | "partially_correct"
  | "incorrect"
  | "not_attempted"
  | "needs_review";

export type AssessmentQuestion = {
  id: string;
  originalNumber: string;
  normalizedNumber: string;
  text: string;
  pageNumber: number;
  marks?: number;
  extractionConfidence?: number;
  status: QuestionStatus;
  answerId?: string;
  mappingConfidence?: number;
  score?: number;
  evaluation?: EvaluationState;
  feedback?: string;
  mappingReason?: string;
};

export type ExtractedAnswer = {
  id: string;
  detectedLabel?: string;
  text: string;
  regions: AnswerRegion[];
  startPage: number;
  endPage: number;
  confidence: number;
};

export type AnswerMapping = {
  questionId?: string;
  answerId: string;
  confidence: number;
  status: "mapped" | "uncertain" | "unmapped";
  reasoning?: string;
};

export type AssessmentSummary = {
  totalQuestions: number;
  answered: number;
  partiallyAnswered: number;
  unanswered: number;
  needsReview: number;
  highConfidence: number;
  mediumConfidence: number;
  earnedMarks: number;
  totalMarks: number;
};

export type AssessmentDocument = {
  name: string;
  pageCount: number;
};

export type AssessmentResult = {
  id: string;
  mode: "demo" | "live";
  model: string;
  createdAt: string;
  questionPaper: AssessmentDocument;
  answerSheet: AssessmentDocument;
  questions: AssessmentQuestion[];
  answers: ExtractedAnswer[];
  mappings: AnswerMapping[];
  unmappedAnswerIds: string[];
  summary: AssessmentSummary;
  warnings: string[];
};

export type AnalysisProgress = {
  stage: "uploading" | "extracting" | "mapping" | "finalizing";
  value: number;
  label: string;
  detail: string;
};

export type UploadedDocument = {
  files: File[];
  displayName: string;
  totalBytes: number;
  pageCount: number;
};
