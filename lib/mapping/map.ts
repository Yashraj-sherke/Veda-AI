import type {
  AnswerMapping,
  AssessmentQuestion,
  ExtractedAnswer,
} from "@/types/assessment";
import { normalizeQuestionLabel } from "./normalize";

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "describe", "explain",
  "for", "from", "how", "in", "is", "it", "of", "on", "or", "the", "to",
  "what", "which", "with", "write", "your",
]);

function tokens(value: string) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2 && !STOP_WORDS.has(token)),
  );
}

export function lexicalSimilarity(question: string, answer: string): number {
  const questionTokens = tokens(question);
  const answerTokens = tokens(answer);
  if (!questionTokens.size || !answerTokens.size) return 0;
  let overlap = 0;
  questionTokens.forEach((token) => {
    if (answerTokens.has(token)) overlap += 1;
  });
  return overlap / Math.max(1, Math.min(questionTokens.size, answerTokens.size));
}

/**
 * First-pass mapping. Explicit labels win; only strong lexical matches are accepted.
 * Low-confidence leftovers are intentionally left for the AI/reviewer.
 */
export function createDeterministicMappings(
  questions: Pick<AssessmentQuestion, "id" | "originalNumber" | "normalizedNumber" | "text">[],
  answers: ExtractedAnswer[],
): AnswerMapping[] {
  const mappings: AnswerMapping[] = [];
  const usedQuestionIds = new Set<string>();
  const questionByLabel = new Map(
    questions.map((question) => [
      question.normalizedNumber || normalizeQuestionLabel(question.originalNumber),
      question,
    ]),
  );

  for (const answer of answers) {
    const explicit = questionByLabel.get(normalizeQuestionLabel(answer.detectedLabel));
    if (explicit && !usedQuestionIds.has(explicit.id)) {
      const confidence = Math.min(0.99, Math.max(0.9, answer.confidence));
      mappings.push({
        questionId: explicit.id,
        answerId: answer.id,
        confidence,
        status: "mapped",
        reasoning: "The handwritten question label matches the printed label.",
      });
      usedQuestionIds.add(explicit.id);
      continue;
    }

    let candidate: (typeof questions)[number] | undefined;
    let score = 0;
    for (const question of questions) {
      if (usedQuestionIds.has(question.id)) continue;
      const similarity = lexicalSimilarity(question.text, answer.text);
      if (similarity > score) {
        score = similarity;
        candidate = question;
      }
    }

    if (candidate && score >= 0.55) {
      mappings.push({
        questionId: candidate.id,
        answerId: answer.id,
        confidence: Math.min(0.88, 0.64 + score * 0.25),
        status: "mapped",
        reasoning: "No label was visible; key concepts strongly match the question.",
      });
      usedQuestionIds.add(candidate.id);
    } else if (candidate && score >= 0.28) {
      mappings.push({
        questionId: candidate.id,
        answerId: answer.id,
        confidence: Math.min(0.69, 0.42 + score * 0.45),
        status: "uncertain",
        reasoning: "The wording may match, but the missing label needs teacher review.",
      });
      usedQuestionIds.add(candidate.id);
    } else {
      mappings.push({
        answerId: answer.id,
        confidence: Math.min(0.45, answer.confidence * 0.45),
        status: "unmapped",
        reasoning: "No reliable question label or semantic match was found.",
      });
    }
  }

  return mappings;
}
