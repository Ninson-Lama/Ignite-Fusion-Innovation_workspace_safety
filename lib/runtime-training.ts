import { isCuratedModuleCoverPath } from "@/lib/module-covers";
import { inferActivityKindFromScenarioIds, type ActivityKind } from "@/lib/mini-games";
import type { PublishedModuleMetadata } from "@/lib/queries";
import { getTrainingModule, MODULE_PREVIEWS } from "@/lib/training-data";
import type { LearningSection, PublicActivityScenario } from "@/types";

export interface RuntimeTrainingModule {
  slug: string;
  title: string;
  description: string;
  category: string;
  estimatedMinutes: number;
  difficulty: string;
  passMark: number;
  label: string;
  visualClass: string;
  objectives: string[];
  learning: LearningSection[];
  activities: PublicActivityScenario[];
  activityKind: ActivityKind;
  heroImagePath: string;
  heroImageAlt: string;
  isBuiltIn: boolean;
}

export function safeModuleHeroPath(value: string | null | undefined, fallback = "/training-hazard-perception.png") {
  if (isCuratedModuleCoverPath(value)) return value;
  if (typeof value === "string") {
    try {
      const url = new URL(value);
      if (
        url.protocol === "https:"
        && url.hostname === "rrvpnkrkrptduazncchx.supabase.co"
        && url.pathname.startsWith("/storage/v1/object/sign/module-covers/")
      ) return value;
    } catch {
      // Stored object names are never renderable without a server signature.
    }
  }
  return fallback;
}

export function getRuntimeTrainingModule(module: PublishedModuleMetadata): RuntimeTrainingModule | null {
  const builtIn = getTrainingModule(module.slug);
  if (builtIn) {
    const preview = MODULE_PREVIEWS[builtIn.slug];
    return {
      slug: module.slug,
      title: module.title,
      description: module.description,
      category: module.category,
      estimatedMinutes: module.estimatedMinutes,
      difficulty: module.difficulty,
      passMark: module.passMark,
      label: builtIn.label,
      visualClass: builtIn.visualClass,
      objectives: builtIn.objectives,
      learning: builtIn.learning,
      activities: builtIn.activities.map((scenario, index) => ({
        id: scenario.id,
        number: String(index + 1).padStart(2, "0"),
        situation: scenario.situation,
        prompt: scenario.prompt,
        choices: scenario.choices.map((choice) => ({ id: choice.id, label: choice.label })),
      })),
      activityKind: "decision",
      heroImagePath: safeModuleHeroPath(module.heroImageUrl, preview.src),
      heroImageAlt: preview.alt,
      isBuiltIn: true,
    };
  }

  if (!module.content || module.content.learning.length < 1 || module.content.scenarios.length < 1) return null;
  return {
    slug: module.slug,
    title: module.title,
    description: module.description,
    category: module.category,
    estimatedMinutes: module.estimatedMinutes,
    difficulty: module.difficulty,
    passMark: module.passMark,
    label: "Organisation training module",
    visualClass: "module-visual-default",
    objectives: module.learningObjectives,
    learning: module.content.learning,
    activities: module.content.scenarios.map((scenario, index) => ({
      ...scenario,
      number: String(index + 1).padStart(2, "0"),
    })),
    activityKind: module.content.activityKind
      ?? inferActivityKindFromScenarioIds(module.content.scenarios.map((scenario) => scenario.id)),
    heroImagePath: safeModuleHeroPath(module.heroImageUrl),
    heroImageAlt: `${module.title} training preview`,
    isBuiltIn: false,
  };
}
