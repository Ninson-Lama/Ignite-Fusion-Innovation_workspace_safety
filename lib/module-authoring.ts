import { z } from "zod";
import { GAME_KINDS, interactiveGameId } from "@/lib/learning-games";
import { isCuratedModuleCoverPath, isUploadedModuleCoverPath } from "@/lib/module-covers";
import {
  ACTIVITY_KINDS,
  inferActivityKindFromScenarioIds,
  isMiniGameActivityKind,
} from "@/lib/mini-games";

export const MODULE_HERO_OPTIONS = [
  { value: "/training-hazard-perception.png", label: "Warehouse inspection" },
  { value: "/training-manual-handling.png", label: "Safe material handling" },
  { value: "/training-working-at-height.png", label: "Working at height" },
  { value: "/training-cyber-awareness.png", label: "Digital safety" },
] as const;

const identifierSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/);
const optionIdentifierSchema = z.string().regex(/^[a-z0-9][a-z0-9_-]{0,19}$/);
const boundedDraftText = (maximum: number) => z.string().trim().max(maximum);

export const authoredLearningSectionSchema = z.object({
  id: identifierSchema,
  title: boundedDraftText(120),
  summary: boundedDraftText(800),
  points: z.array(boundedDraftText(240)).max(6),
});

export const authoredScenarioSchema = z.object({
  id: identifierSchema,
  situation: boundedDraftText(800),
  prompt: boundedDraftText(500),
  choices: z.array(z.object({
    id: optionIdentifierSchema,
    label: boundedDraftText(300),
    feedback: boundedDraftText(800),
    isCorrect: z.boolean(),
  })).min(2).max(4),
});

export const authoredQuestionSchema = z.object({
  id: z.string().uuid(),
  questionType: z.enum(["single_choice", "multiple_choice", "true_false"]),
  prompt: boundedDraftText(500),
  explanation: boundedDraftText(1000),
  points: z.number().int().min(1).max(100),
  options: z.array(z.object({
    id: optionIdentifierSchema,
    label: boundedDraftText(300),
    isCorrect: z.boolean(),
  })).min(2).max(6),
});

export const moduleAuthoringDefinitionSchema = z.object({
  title: z.string().trim().min(3).max(120),
  slug: z.string().trim().min(3).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().min(10).max(800),
  overview: z.string().trim().min(20).max(2000),
  category: z.string().trim().min(2).max(80),
  estimatedMinutes: z.number().int().min(5).max(240),
  difficulty: z.enum(["introductory", "intermediate", "advanced"]),
  passMark: z.number().int().min(1).max(100),
  pointsAvailable: z.number().int().min(0).max(5000),
  sortOrder: z.number().int().min(0).max(10000),
  heroImagePath: z.string().refine(
    (value) => isCuratedModuleCoverPath(value) || isUploadedModuleCoverPath(value),
    "Choose a curated cover or upload a supported module-owned image.",
  ),
  activityKind: z.enum(ACTIVITY_KINDS).default("decision"),
  learningObjectives: z.array(boundedDraftText(200)).max(8),
  learning: z.array(authoredLearningSectionSchema).max(12),
  scenarios: z.array(authoredScenarioSchema).max(12),
  questions: z.array(authoredQuestionSchema).max(20),
}).superRefine((definition, context) => {
  if (!definition.scenarios.some((scenario) => scenario.id.startsWith("play-"))) return;
  const game = interactiveGameId(definition.scenarios);
  const choices = definition.scenarios[0]?.choices ?? [];
  if (!game || definition.activityKind !== GAME_KINDS[game] || choices.length !== 2
    || !choices.some((choice) => choice.id === "pass" && choice.isCorrect)
    || !choices.some((choice) => choice.id === "review" && !choice.isCorrect)) {
    context.addIssue({ code: "custom", path: ["scenarios"], message: "Use the unchanged interactive mission template. Its safety rules and score mapping are fixed." });
  }
});

export type ModuleAuthoringDefinition = z.infer<typeof moduleAuthoringDefinitionSchema>;
export type AuthoredLearningSection = z.infer<typeof authoredLearningSectionSchema>;
export type AuthoredScenario = z.infer<typeof authoredScenarioSchema>;
export type AuthoredQuestion = z.infer<typeof authoredQuestionSchema>;

export interface AuthoringReadiness {
  ready: boolean;
  blockers: string[];
  steps: {
    overview: boolean;
    learning: boolean;
    practice: boolean;
    assessment: boolean;
  };
  counts: {
    objectives: number;
    learningSections: number;
    scenarios: number;
    questions: number;
  };
}

function uniqueIds(values: Array<{ id: string }>) {
  return new Set(values.map((value) => value.id)).size === values.length;
}

export function getAuthoringReadiness(definition: ModuleAuthoringDefinition): AuthoringReadiness {
  const blockers: string[] = [];
  const objectives = definition.learningObjectives.filter((objective) => objective.trim().length >= 5);
  const overviewReady = Boolean(
    definition.title.trim().length >= 3
      && definition.description.trim().length >= 10
      && definition.overview.trim().length >= 20
      && objectives.length >= 2,
  );
  if (objectives.length < 2) blockers.push("Add at least two clear learning objectives.");

  const learningReady = definition.learning.length >= 2
    && uniqueIds(definition.learning)
    && definition.learning.every((section) =>
      section.title.trim().length >= 3
      && section.summary.trim().length >= 10
      && section.points.filter((point) => point.trim().length >= 5).length >= 2,
    );
  if (definition.learning.length < 2) blockers.push("Add at least two learning sections.");
  definition.learning.forEach((section, index) => {
    if (section.title.trim().length < 3 || section.summary.trim().length < 10) {
      blockers.push(`Complete the title and summary for learning section ${index + 1}.`);
    }
    if (section.points.filter((point) => point.trim().length >= 5).length < 2) {
      blockers.push(`Add at least two useful key points to learning section ${index + 1}.`);
    }
  });

  const practiceReady = definition.scenarios.length >= 1
    && uniqueIds(definition.scenarios)
    && definition.scenarios.every((scenario) =>
      scenario.situation.trim().length >= 10
      && scenario.prompt.trim().length >= 8
      && uniqueIds(scenario.choices)
      && scenario.choices.every((choice) => choice.label.trim().length >= 3 && choice.feedback.trim().length >= 8)
      && scenario.choices.filter((choice) => choice.isCorrect).length === 1,
    );
  const practiceName = isMiniGameActivityKind(definition.activityKind) ? "game round" : "practical decision scenario";
  if (!definition.scenarios.length) blockers.push(`Add at least one ${practiceName}.`);
  definition.scenarios.forEach((scenario, index) => {
    if (scenario.situation.trim().length < 10 || scenario.prompt.trim().length < 8) {
      blockers.push(`Complete the situation and question for ${practiceName} ${index + 1}.`);
    }
    if (scenario.choices.filter((choice) => choice.isCorrect).length !== 1) {
      blockers.push(`Choose exactly one safest answer for ${practiceName} ${index + 1}.`);
    }
    if (scenario.choices.some((choice) => choice.label.trim().length < 3 || choice.feedback.trim().length < 8)) {
      blockers.push(`Complete every choice and feedback message in ${practiceName} ${index + 1}.`);
    }
  });

  const assessmentReady = definition.questions.length >= 3
    && uniqueIds(definition.questions)
    && definition.questions.every((question) => {
      const correctCount = question.options.filter((option) => option.isCorrect).length;
      const expectedCorrectCount = question.questionType === "multiple_choice" ? correctCount >= 1 : correctCount === 1;
      return question.prompt.trim().length >= 8
        && question.explanation.trim().length >= 8
        && uniqueIds(question.options)
        && question.options.every((option) => option.label.trim().length >= 1)
        && expectedCorrectCount;
    });
  if (definition.questions.length < 3) blockers.push("Add at least three assessment questions.");
  definition.questions.forEach((question, index) => {
    if (question.prompt.trim().length < 8 || question.explanation.trim().length < 8) {
      blockers.push(`Complete the prompt and explanation for question ${index + 1}.`);
    }
    const correctCount = question.options.filter((option) => option.isCorrect).length;
    if ((question.questionType === "multiple_choice" && correctCount < 1)
      || (question.questionType !== "multiple_choice" && correctCount !== 1)) {
      blockers.push(`Set a valid protected answer key for question ${index + 1}.`);
    }
  });

  return {
    ready: overviewReady && learningReady && practiceReady && assessmentReady,
    blockers: [...new Set(blockers)],
    steps: { overview: overviewReady, learning: learningReady, practice: practiceReady, assessment: assessmentReady },
    counts: {
      objectives: objectives.length,
      learningSections: definition.learning.length,
      scenarios: definition.scenarios.length,
      questions: definition.questions.length,
    },
  };
}

const publicLearningSchema = z.array(z.object({
  id: identifierSchema,
  title: z.string(),
  summary: z.string(),
  points: z.array(z.string()),
}));

const publicScenariosSchema = z.array(z.object({
  id: identifierSchema,
  situation: z.string(),
  prompt: z.string(),
  choices: z.array(z.object({ id: optionIdentifierSchema, label: z.string() })),
}));

const publicContentSchema = z.discriminatedUnion("schemaVersion", [
  z.object({
    schemaVersion: z.literal(1),
    learning: publicLearningSchema,
    scenarios: publicScenariosSchema,
  }),
  z.object({
    schemaVersion: z.literal(2),
    activityKind: z.enum(ACTIVITY_KINDS),
    learning: publicLearningSchema,
    scenarios: publicScenariosSchema,
  }),
]).transform((content) => ({
  ...content,
  activityKind: content.schemaVersion === 2
    ? content.activityKind
    : inferActivityKindFromScenarioIds(content.scenarios.map((scenario) => scenario.id)),
}));

export type AuthoredPublicContent = z.infer<typeof publicContentSchema>;

export function parseAuthoredPublicContent(value: unknown): AuthoredPublicContent | null {
  const result = publicContentSchema.safeParse(value);
  return result.success ? result.data : null;
}
