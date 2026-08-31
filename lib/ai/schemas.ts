import { z } from "zod";

export const questionExtractionSchema = z.object({
  questions: z.array(
    z.object({
      originalNumber: z.string().min(1),
      text: z.string().min(1),
      pageNumber: z.number().int().positive(),
      marks: z.number().nonnegative().nullable().optional(),
      confidence: z.number().min(0).max(1).default(0.8),
    }),
  ),
});

export const answerExtractionSchema = z.object({
  answers: z.array(
    z.object({
      detectedLabel: z.string().nullable().optional(),
      text: z.string().min(1),
      confidence: z.number().min(0).max(1),
      regions: z.array(
        z.object({
          pageNumber: z.number().int().positive(),
          x: z.number(),
          y: z.number(),
          width: z.number(),
          height: z.number(),
          confidence: z.number().min(0).max(1),
        }),
      ).min(1),
    }),
  ),
});

export const mappingGradeSchema = z.object({
  decisions: z.array(
    z.object({
      questionNumber: z.string().nullable().optional(),
      answerId: z.string().min(1),
      confidence: z.number().min(0).max(1),
      status: z.enum(["mapped", "uncertain", "unmapped"]),
      score: z.number().nonnegative().nullable().optional(),
      evaluation: z.enum(["correct", "partially_correct", "incorrect", "needs_review"]).nullable().optional(),
      feedback: z.string().nullable().optional(),
      reasoning: z.string().nullable().optional(),
    }),
  ),
});
