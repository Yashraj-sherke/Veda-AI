import type { AssessmentQuestion, AssessmentSummary } from "@/types/assessment";

export function calculateSummary(questions: AssessmentQuestion[]): AssessmentSummary {
  return {
    totalQuestions: questions.length,
    answered: questions.filter((question) => question.status === "answered").length,
    partiallyAnswered: questions.filter((question) => question.status === "partially_answered").length,
    unanswered: questions.filter((question) => question.status === "unanswered").length,
    needsReview: questions.filter((question) => question.status === "needs_review").length,
    highConfidence: questions.filter((question) => (question.mappingConfidence ?? 0) >= 0.9).length,
    mediumConfidence: questions.filter((question) => {
      const confidence = question.mappingConfidence ?? 0;
      return confidence >= 0.7 && confidence < 0.9;
    }).length,
    earnedMarks: questions.reduce((sum, question) => sum + (question.score ?? 0), 0),
    totalMarks: questions.reduce((sum, question) => sum + (question.marks ?? 0), 0),
  };
}
