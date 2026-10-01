import { isMiniGameActivityKind, type ActivityKind } from "@/lib/mini-games";
import type { ModuleAuthoringDefinition } from "@/lib/module-authoring";
import { createInteractiveGameScenario } from "@/lib/server/mini-game-seeds";

export function createStarterAuthoringDefinition(input: {
  title: string;
  slug: string;
  description: string;
  overview: string;
  category: string;
  estimatedMinutes: number;
  difficulty: "introductory" | "intermediate" | "advanced";
  passMark: number;
  pointsAvailable: number;
  sortOrder: number;
  learningObjectives: string[];
  activityKind?: ActivityKind;
}): ModuleAuthoringDefinition {
  const activityKind = input.activityKind ?? "decision";
  return {
    ...input,
    activityKind,
    heroImagePath: "/training-hazard-perception.png",
    learning: [],
    scenarios: isMiniGameActivityKind(activityKind) ? createInteractiveGameScenario(activityKind) : [],
    questions: [],
  };
}
