export const ACTIVITY_KINDS = [
  "decision",
  "forklift_precheck",
  "ppe_dress_up",
  "sorting_zone",
  "load_stacking",
] as const;

export type ActivityKind = (typeof ACTIVITY_KINDS)[number];
export type MiniGameActivityKind = Exclude<ActivityKind, "decision">;

export interface MiniGameTemplateDefinition {
  id: MiniGameActivityKind;
  name: string;
  shortName: string;
  category: string;
  description: string;
  interaction: string;
}

export const MINI_GAME_TEMPLATES: readonly MiniGameTemplateDefinition[] = [
  {
    id: "forklift_precheck",
    name: "Forklift Simulator",
    shortName: "Forklift simulator",
    category: "Equipment inspection",
    description: "Practise safe navigation, controls, moving protocols and pre-shift checks before a truck enters service.",
    interaction: "Navigate a warehouse route, collect and deliver a load, yield at the crossing and park safely.",
  },
  {
    id: "ppe_dress_up",
    name: "PPE Dress-Up",
    shortName: "PPE challenge",
    category: "Personal protection",
    description: "Build the correct PPE kit for changing workplace conditions without treating PPE as the first control.",
    interaction: "Equip individual items for three workplace scenarios using drag-and-drop or touch controls.",
  },
  {
    id: "sorting_zone",
    name: "The Sorting Zone",
    shortName: "Sorting zone",
    category: "Stock, hazards and waste",
    description: "Sort stock, hazardous-material and waste cards into their correct destination or incident response.",
    interaction: "Place six cards in the correct bins using drag-and-drop or tap-to-place controls.",
  },
  {
    id: "load_stacking",
    name: "Load Stacking Challenge",
    shortName: "Load stacking",
    category: "Rack and load safety",
    description: "Place loads into safe rack positions while respecting weight, stability, condition and rated capacity.",
    interaction: "Arrange five pallets across two rated bays, keeping damaged loads in hold and respecting the loading plan.",
  },
] as const;

export function isMiniGameActivityKind(value: ActivityKind): value is MiniGameActivityKind {
  return value !== "decision";
}

export function getMiniGameTemplate(kind: ActivityKind | null | undefined) {
  if (!kind || kind === "decision") return null;
  return MINI_GAME_TEMPLATES.find((template) => template.id === kind) ?? null;
}

export function inferActivityKindFromScenarioIds(scenarioIds: readonly string[]): ActivityKind {
  const firstId = scenarioIds[0] ?? "";
  if (firstId.startsWith("game-forklift-")) return "forklift_precheck";
  if (firstId.startsWith("game-ppe-")) return "ppe_dress_up";
  if (firstId.startsWith("game-sort-")) return "sorting_zone";
  if (firstId.startsWith("game-stack-")) return "load_stacking";
  return "decision";
}

export function miniGameScenarioPrefix(kind: MiniGameActivityKind) {
  if (kind === "forklift_precheck") return "game-forklift";
  if (kind === "ppe_dress_up") return "game-ppe";
  if (kind === "sorting_zone") return "game-sort";
  return "game-stack";
}
