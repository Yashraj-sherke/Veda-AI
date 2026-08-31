import { calculateSummary } from "@/lib/assessment";
import { normalizeQuestionLabel } from "@/lib/mapping/normalize";
import type {
  AnswerMapping,
  AssessmentQuestion,
  AssessmentResult,
  ExtractedAnswer,
  QuestionStatus,
} from "@/types/assessment";

const questionSeed: Array<
  [string, string, number, QuestionStatus, string | undefined, number, number, string]
> = [
  ["1", "Which blood vessel carries blood away from the heart?", 2, "answered", "answer-1", 0.98, 2, "Correctly identifies arteries and their direction of flow."],
  ["2", "Which of the following organelles is primarily involved in photorespiration?", 2, "answered", "answer-2", 0.96, 2, "Correct and supported with the organelle's role."],
  ["3", "Explain the role of chloroplasts in photosynthesis, naming the main pigments and their role during the two major stages.", 2, "needs_review", "answer-3", 0.62, 1, "The response is relevant, but the missing label and brief explanation need review."],
  ["4", "Describe the flow of blood through the human heart starting from the right atrium and ending at the aortic valve.", 2, "unanswered", undefined, 0, 0, "No corresponding answer was found."],
  ["5", "Draw a labelled diagram of an alveolus showing capillaries and air-space. Label alveolar sac, capillary, and direction of gas exchange.", 2, "answered", "answer-5", 0.97, 2, "The key structures and gas-exchange direction are present."],
  ["6", "Draw a neat labelled diagram of the human digestive system and label the stomach, small intestine, large intestine, pancreas and liver.", 5, "answered", "answer-6", 0.95, 4, "Most required structures are clear; one label is imprecise."],
  ["7", "Draw and label a nephron, including Bowman's capsule, glomerulus, proximal tubule, loop of Henle, distal tubule and collecting duct.", 5, "answered", "answer-7", 0.94, 5, "Complete response continued across two pages."],
  ["8", "Explain the structural differences between palisade mesophyll and spongy mesophyll and state how each supports photosynthesis.", 5, "unanswered", undefined, 0, 0, "No corresponding answer was found."],
  ["9", "Describe the process of translocation in plants in two to three sentences and name two environmental factors that increase its rate.", 5, "answered", "answer-9", 0.9, 3, "The transport mechanism is correct; only one environmental factor is clearly stated."],
  ["10", "Explain how the structure of xylem vessels facilitates water transport in plants. Mention one structural feature and its function.", 5, "partially_answered", "answer-10", 0.86, 3, "The structural feature is correct, but its link to transport is incomplete."],
  ["11(a)", "If glucose enters root-cell protoplast, explain how it is utilized for cellular respiration.", 2, "answered", "answer-11a", 0.98, 2, "Correctly connects glucose breakdown with ATP release."],
  ["11(b)", "Suggest one practical measure to help Plant B recover after prolonged waterlogging.", 2, "partially_answered", "answer-11b", 0.82, 1, "The suggestion is plausible but needs a clearer physiological reason."],
  ["12", "A limiting process has a total volume per breath of 0.5 L and breathes 12 times per minute. Calculate the minute ventilation.", 5, "answered", "answer-12", 0.97, 4, "The method and result are correct; units should be stated more clearly."],
];

function region(id: string, pageNumber: number, x: number, y: number, width: number, height: number, confidence = 0.95) {
  return { id, pageNumber, boundingBox: { x, y, width, height }, confidence };
}

const answers: ExtractedAnswer[] = [
  {
    id: "answer-1",
    detectedLabel: "Q1",
    text: "Arteries carry blood away from the heart. They have thick elastic walls to withstand high pressure.",
    regions: [region("region-1", 1, 0.07, 0.08, 0.86, 0.13)],
    startPage: 1,
    endPage: 1,
    confidence: 0.98,
  },
  {
    id: "answer-11a",
    detectedLabel: "11 - a",
    text: "Glucose is broken down in glycolysis, then oxidised in mitochondria. The released energy is stored as ATP.",
    regions: [region("region-11a", 1, 0.07, 0.25, 0.86, 0.17)],
    startPage: 1,
    endPage: 1,
    confidence: 0.97,
  },
  {
    id: "answer-2",
    detectedLabel: "Q. 2",
    text: "The peroxisome is mainly involved in photorespiration. It works with chloroplasts and mitochondria in the pathway.",
    regions: [region("region-2", 1, 0.07, 0.48, 0.86, 0.15)],
    startPage: 1,
    endPage: 1,
    confidence: 0.96,
  },
  {
    id: "answer-3",
    text: "Chlorophyll a captures light energy. Light reactions make ATP and NADPH, which are then used to fix carbon in the Calvin cycle.",
    regions: [region("region-3", 1, 0.07, 0.7, 0.86, 0.19, 0.78)],
    startPage: 1,
    endPage: 1,
    confidence: 0.78,
  },
  {
    id: "answer-6",
    detectedLabel: "6",
    text: "Digestive system diagram: liver, stomach, pancreas, small intestine and large intestine are labelled.",
    regions: [region("region-6", 2, 0.07, 0.08, 0.86, 0.25)],
    startPage: 2,
    endPage: 2,
    confidence: 0.95,
  },
  {
    id: "answer-5",
    detectedLabel: "Q5",
    text: "Alveoli have thin moist walls and are surrounded by capillaries. Oxygen diffuses into blood and carbon dioxide diffuses out.",
    regions: [region("region-5", 2, 0.07, 0.39, 0.86, 0.17)],
    startPage: 2,
    endPage: 2,
    confidence: 0.97,
  },
  {
    id: "answer-7",
    detectedLabel: "7",
    text: "The nephron begins with Bowman's capsule and glomerulus. Filtrate passes through the proximal tubule and loop of Henle, then the distal tubule and collecting duct. Selective reabsorption returns useful substances to blood.",
    regions: [
      region("region-7a", 2, 0.07, 0.63, 0.86, 0.29),
      region("region-7b", 3, 0.07, 0.08, 0.86, 0.2),
    ],
    startPage: 2,
    endPage: 3,
    confidence: 0.94,
  },
  {
    id: "answer-10",
    detectedLabel: "10",
    text: "Xylem vessels are long hollow tubes with no end walls. Lignin strengthens them and prevents collapse.",
    regions: [region("region-10", 3, 0.07, 0.35, 0.86, 0.15)],
    startPage: 3,
    endPage: 3,
    confidence: 0.9,
  },
  {
    id: "answer-9",
    detectedLabel: "9",
    text: "Translocation moves sucrose through phloem from sources to sinks using pressure flow. Warm temperature increases the rate.",
    regions: [region("region-9", 3, 0.07, 0.55, 0.86, 0.15)],
    startPage: 3,
    endPage: 3,
    confidence: 0.91,
  },
  {
    id: "answer-11b",
    detectedLabel: "11 b",
    text: "Improve soil drainage and avoid overwatering so roots can receive oxygen again.",
    regions: [region("region-11b", 3, 0.07, 0.76, 0.86, 0.12)],
    startPage: 3,
    endPage: 3,
    confidence: 0.88,
  },
  {
    id: "answer-12",
    detectedLabel: "12",
    text: "Minute ventilation = tidal volume × breathing rate = 0.5 × 12 = 6 litres per minute.",
    regions: [region("region-12", 4, 0.07, 0.1, 0.86, 0.18)],
    startPage: 4,
    endPage: 4,
    confidence: 0.98,
  },
  {
    id: "answer-unmapped",
    detectedLabel: "Q14?",
    text: "Extra note: enzymes lower activation energy and are not used up in the reaction.",
    regions: [region("region-unmapped", 4, 0.07, 0.62, 0.86, 0.17, 0.63)],
    startPage: 4,
    endPage: 4,
    confidence: 0.63,
  },
];

export function createDemoAssessment(options?: {
  questionPaperName?: string;
  answerSheetName?: string;
  questionPaperPages?: number;
  answerSheetPages?: number;
}): AssessmentResult {
  const questions: AssessmentQuestion[] = questionSeed.map(
    ([number, text, marks, status, answerId, confidence, score, feedback], index) => ({
      id: `question-${number.replace(/[^a-z0-9]/gi, "-")}`,
      originalNumber: number,
      normalizedNumber: normalizeQuestionLabel(number),
      text,
      pageNumber: Math.floor(index / 7) + 1,
      marks,
      extractionConfidence: 0.98,
      status,
      answerId,
      mappingConfidence: confidence || undefined,
      score,
      evaluation:
        status === "unanswered"
          ? "not_attempted"
          : status === "needs_review"
            ? "needs_review"
            : score === marks
              ? "correct"
              : "partially_correct",
      feedback,
      mappingReason:
        status === "needs_review"
          ? "No question number was visible; the answer was matched by concepts and nearby context."
          : answerId
            ? "The handwritten label matches the printed question number."
            : undefined,
    }),
  );

  const mappings: AnswerMapping[] = answers.map((answer) => {
    const question = questions.find((item) => item.answerId === answer.id);
    if (!question) {
      return {
        answerId: answer.id,
        confidence: 0.42,
        status: "unmapped",
        reasoning: "The written label does not exist on the question paper.",
      };
    }
    return {
      questionId: question.id,
      answerId: answer.id,
      confidence: question.mappingConfidence ?? 0,
      status: question.status === "needs_review" ? "uncertain" : "mapped",
      reasoning: question.mappingReason,
    };
  });

  return {
    id: `demo-${Date.now()}`,
    mode: "demo",
    model: "Deterministic demo dataset",
    createdAt: new Date().toISOString(),
    questionPaper: {
      name: options?.questionPaperName ?? "Class_10_biology_unit_test.pdf",
      pageCount: options?.questionPaperPages ?? 2,
    },
    answerSheet: {
      name: options?.answerSheetName ?? "student_1_answer_sheet.pdf",
      pageCount: options?.answerSheetPages ?? 4,
    },
    questions,
    answers,
    mappings,
    unmappedAnswerIds: ["answer-unmapped"],
    summary: calculateSummary(questions),
    warnings: [
      "Question 3 was mapped semantically because no handwritten label was visible.",
      "One extra response could not be matched to the question paper.",
    ],
  };
}
