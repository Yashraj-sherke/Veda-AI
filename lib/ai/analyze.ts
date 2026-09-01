import { calculateSummary } from "@/lib/assessment";
import { createDeterministicMappings } from "@/lib/mapping/map";
import { normalizeQuestionLabel } from "@/lib/mapping/normalize";
import type { AnswerMapping, AssessmentQuestion, AssessmentResult } from "@/types/assessment";
import type { AssessmentAIProvider, DocumentInput } from "./provider";

export async function analyzeAssessment(params: {
  provider: AssessmentAIProvider;
  questionPaper: DocumentInput;
  answerSheet: DocumentInput;
  questionPaperName: string;
  answerSheetName: string;
  questionPaperPageCount: number;
  answerSheetPageCount: number;
}) {
  const { provider } = params;
  // Run the independent extraction calls together so the complete request stays
  // within hosting proxy timeouts. Provider calls have their own bounded timeout.
  const [questionDrafts, answers] = await Promise.all([
    provider.extractQuestions(params.questionPaper),
    provider.extractAnswers(params.answerSheet),
  ]);

  if (!questionDrafts.length) throw new Error("No printed questions could be identified in the question paper.");

  const baseQuestions: AssessmentQuestion[] = questionDrafts.map((question, index) => ({
    id: `question-${index + 1}`,
    originalNumber: question.originalNumber,
    normalizedNumber: normalizeQuestionLabel(question.originalNumber),
    text: question.text,
    pageNumber: question.pageNumber,
    marks: question.marks,
    extractionConfidence: question.confidence,
    status: "unanswered",
    score: 0,
    evaluation: "not_attempted",
  }));

  const deterministic = createDeterministicMappings(baseQuestions, answers);
  const decisions = answers.length > 0
    ? await provider.mapAndGradeAnswers(questionDrafts, answers, deterministic)
    : [];
  const questionByNumber = new Map(baseQuestions.map((question) => [question.normalizedNumber, question]));
  const locked = new Map(
    deterministic
      .filter((mapping) => mapping.status === "mapped" && mapping.confidence >= 0.9)
      .map((mapping) => [mapping.answerId, mapping]),
  );
  const decisionByAnswer = new Map(decisions.map((decision) => [decision.answerId, decision]));

  const mappings: AnswerMapping[] = answers.map((answer) => {
    const lockedMapping = locked.get(answer.id);
    const decision = decisionByAnswer.get(answer.id);
    const question = decision?.questionNumber
      ? questionByNumber.get(normalizeQuestionLabel(decision.questionNumber))
      : undefined;

    if (lockedMapping) {
      return {
        ...lockedMapping,
        reasoning: decision?.reasoning || lockedMapping.reasoning,
      };
    }
    if (decision && decision.status !== "unmapped" && question) {
      return {
        questionId: question.id,
        answerId: answer.id,
        confidence: decision.confidence,
        status: decision.status,
        reasoning: decision.reasoning,
      };
    }
    return deterministic.find((mapping) => mapping.answerId === answer.id) ?? {
      answerId: answer.id,
      confidence: 0,
      status: "unmapped",
    };
  });

  const hydratedQuestions = baseQuestions.map((question) => {
    const mapping = mappings.find((candidate) => candidate.questionId === question.id);
    if (!mapping) return question;
    const decision = decisionByAnswer.get(mapping.answerId);
    const answer = answers.find((candidate) => candidate.id === mapping.answerId);
    const score = Math.min(question.marks ?? Number.POSITIVE_INFINITY, decision?.score ?? 0);
    const status =
      mapping.status === "uncertain" || mapping.confidence < 0.7
        ? "needs_review"
        : decision?.evaluation === "partially_correct"
          ? "partially_answered"
          : "answered";
    return {
      ...question,
      status,
      answerId: answer?.id,
      mappingConfidence: mapping.confidence,
      mappingReason: mapping.reasoning,
      score,
      evaluation: decision?.evaluation ?? "needs_review",
      feedback: decision?.feedback || "Review the original response before confirming this AI estimate.",
    } satisfies AssessmentQuestion;
  });

  const answerPages = answers.flatMap((answer) => answer.regions.map((region) => region.pageNumber));
  const questionPages = questionDrafts.map((question) => question.pageNumber);
  const unmappedAnswerIds = mappings.filter((mapping) => mapping.status === "unmapped").map((mapping) => mapping.answerId);

  const result: AssessmentResult = {
    id: `assessment-${Date.now()}`,
    mode: "live",
    model: provider.model,
    createdAt: new Date().toISOString(),
    questionPaper: {
      name: params.questionPaperName,
      pageCount: Math.max(params.questionPaperPageCount, 1, ...questionPages),
    },
    answerSheet: {
      name: params.answerSheetName,
      pageCount: Math.max(params.answerSheetPageCount, 1, ...answerPages),
    },
    questions: hydratedQuestions,
    answers,
    mappings,
    unmappedAnswerIds,
    summary: calculateSummary(hydratedQuestions),
    warnings: [
      ...hydratedQuestions
        .filter((question) => question.status === "needs_review")
        .map((question) => `Question ${question.originalNumber} needs a teacher review.`),
      ...(unmappedAnswerIds.length ? [`${unmappedAnswerIds.length} extracted answer could not be mapped confidently.`] : []),
    ],
  };
  return result;
}
