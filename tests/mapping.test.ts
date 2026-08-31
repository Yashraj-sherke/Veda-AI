import { describe, expect, it } from "vitest";
import { createDeterministicMappings } from "@/lib/mapping/map";
import { normalizeQuestionLabel } from "@/lib/mapping/normalize";
import type { AssessmentQuestion, ExtractedAnswer } from "@/types/assessment";

function question(number: string, text: string) {
  return {
    id: `q-${number}`,
    originalNumber: number,
    normalizedNumber: normalizeQuestionLabel(number),
    text,
  } satisfies Pick<AssessmentQuestion, "id" | "originalNumber" | "normalizedNumber" | "text">;
}

function answer(id: string, label: string | undefined, text: string): ExtractedAnswer {
  return {
    id,
    detectedLabel: label,
    text,
    regions: [{ id: `${id}-r`, pageNumber: 1, boundingBox: { x: 0.1, y: 0.1, width: 0.8, height: 0.2 }, confidence: 0.95 }],
    startPage: 1,
    endPage: 1,
    confidence: 0.95,
  };
}

describe("deterministic mapping", () => {
  const questions = [
    question("1", "Explain photosynthesis and the role of chlorophyll."),
    question("4(a)", "Describe arteries carrying blood away from the heart."),
    question("4(b)", "Describe veins carrying blood toward the heart."),
  ];

  it("maps answers by labels even when written out of order", () => {
    const result = createDeterministicMappings(questions, [
      answer("a-4b", "Q4-b", "Veins return blood."),
      answer("a-1", "1", "Photosynthesis captures light."),
      answer("a-4a", "4 (a)", "Arteries carry blood away."),
    ]);
    expect(result.map((mapping) => mapping.questionId)).toEqual(["q-4(b)", "q-1", "q-4(a)"]);
    expect(result.every((mapping) => mapping.status === "mapped")).toBe(true);
  });

  it("can flag an unlabeled semantic candidate as uncertain", () => {
    const result = createDeterministicMappings(
      [question("1", "Explain photosynthesis chlorophyll light energy in leaves.")],
      [answer("unlabeled", undefined, "Chlorophyll in leaves absorbs light for photosynthesis energy.")],
    );
    expect(result[0].questionId).toBe("q-1");
    expect(["mapped", "uncertain"]).toContain(result[0].status);
  });

  it("keeps unrelated content unmapped and questions implicitly unanswered", () => {
    const result = createDeterministicMappings(questions, [
      answer("note", undefined, "Remember to bring a pencil tomorrow."),
    ]);
    expect(result[0]).toMatchObject({ answerId: "note", status: "unmapped" });
  });
});
