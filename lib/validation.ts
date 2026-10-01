import { z } from "zod";

export const moduleSlugSchema = z.string().trim().min(3).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const hazardIdSchema = z.enum([
    "liquid-spill",
    "blocked-exit",
    "unsafe-lift",
    "vehicle-conflict",
    "unsafe-stacking",
    "unsafe-height",
    "missing-ppe",
]);

const scenarioIdSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/);
const choiceIdSchema = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,19}$/);
const moduleIdSchema = z.string().uuid();

export const trainingCheckpointSchema = z.object({
  moduleId: moduleIdSchema,
  stage: z.enum(["overview", "learning", "activity", "quiz"]),
  position: z.number().int().min(0).max(100),
});

export const notificationReadSchema = z.object({
  ids: z.array(z.string().uuid()).max(50).optional(),
});

export const activityCompletionSchema = z.object({
  moduleId: moduleIdSchema,
  moduleSlug: moduleSlugSchema,
  hazardId: hazardIdSchema.optional(),
  scenarioId: scenarioIdSchema.optional(),
  selectedChoiceId: choiceIdSchema.optional(),
}).superRefine((value, context) => {
  if (value.moduleSlug === "hazard-perception") {
    if (!value.hazardId) context.addIssue({ code: "custom", path: ["hazardId"], message: "A recognised hazard is required." });
    return;
  }
  if (!value.scenarioId) context.addIssue({ code: "custom", path: ["scenarioId"], message: "A scenario is required." });
  if (!value.selectedChoiceId) context.addIssue({ code: "custom", path: ["selectedChoiceId"], message: "A choice is required." });
});

export const quizAnswerSchema = z.object({
  questionId: z.string().uuid(),
  selectedAnswer: z.array(z.string().min(1).max(40)).min(1).max(10),
});

export const quizSubmissionSchema = z.object({
  moduleId: moduleIdSchema,
  answers: z.record(z.string().uuid(), z.array(z.string().min(1).max(40)).min(1).max(10)),
});

export const profileUpdateSchema = z.object({
  fullName: z.string().trim().min(2).max(80),
});
