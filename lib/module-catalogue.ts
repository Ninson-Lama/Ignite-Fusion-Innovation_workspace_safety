import type { TrainingModule } from "@/types";

export const BUILT_IN_MODULE_SLUGS = [
  "hazard-perception",
  "manual-handling",
  "working-at-height",
  "cyber-awareness",
] as const satisfies readonly TrainingModule["slug"][];

export function isBuiltInModuleSlug(value: string): value is TrainingModule["slug"] {
  return BUILT_IN_MODULE_SLUGS.some((slug) => slug === value);
}

export function slugifyModuleTitle(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}
