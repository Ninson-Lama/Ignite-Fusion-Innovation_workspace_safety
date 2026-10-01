import { describe, expect, it } from "vitest";
import {
  ACTIVITY_KINDS,
  MINI_GAME_TEMPLATES,
  getMiniGameTemplate,
  inferActivityKindFromScenarioIds,
  isMiniGameActivityKind,
  miniGameScenarioPrefix,
} from "@/lib/mini-games";
import { createMiniGameScenarios } from "@/lib/server/mini-game-seeds";

describe("mini-game catalogue", () => {
  it("defines one template for every non-decision activity kind", () => {
    expect(MINI_GAME_TEMPLATES.map((template) => template.id)).toEqual(ACTIVITY_KINDS.slice(1));
    expect(new Set(MINI_GAME_TEMPLATES.map((template) => template.id)).size).toBe(MINI_GAME_TEMPLATES.length);
  });

  it("keeps every seeded round compatible with protected decision scoring", () => {
    for (const template of MINI_GAME_TEMPLATES) {
      const rounds = createMiniGameScenarios(template.id);
      expect(rounds.length).toBeGreaterThan(0);
      for (const round of rounds) {
        expect(round.id).toMatch(/^[a-z0-9][a-z0-9-]{0,39}$/);
        expect(round.situation.length).toBeGreaterThanOrEqual(10);
        expect(round.prompt.length).toBeGreaterThanOrEqual(8);
        expect(round.choices.length).toBeGreaterThanOrEqual(2);
        expect(round.choices.length).toBeLessThanOrEqual(4);
        expect(new Set(round.choices.map((choice) => choice.id)).size).toBe(round.choices.length);
        expect(round.choices.filter((choice) => choice.isCorrect)).toHaveLength(1);
        expect(round.choices.every((choice) => choice.label.length >= 3 && choice.feedback.length >= 8)).toBe(true);
      }
    }
  });

  it("returns null for decision activities and resolves a mini-game template", () => {
    expect(getMiniGameTemplate("decision")).toBeNull();
    expect(getMiniGameTemplate("ppe_dress_up")?.name).toBe("PPE Dress-Up");
    expect(isMiniGameActivityKind("decision")).toBe(false);
    expect(isMiniGameActivityKind("sorting_zone")).toBe(true);
  });

  it("creates independent editable copies of template rounds", () => {
    const first = createMiniGameScenarios("forklift_precheck");
    const second = createMiniGameScenarios("forklift_precheck");
    expect(first).toEqual(second);

    first[0].situation = "An administrator-specific inspection condition.";
    first[0].choices[0].label = "Custom option";

    expect(second[0].situation).not.toBe(first[0].situation);
    expect(second[0].choices[0].label).not.toBe(first[0].choices[0].label);
    expect(createMiniGameScenarios("forklift_precheck")[0].situation).toBe(second[0].situation);
  });

  it("infers legacy mini-game content only from recognised seed prefixes", () => {
    expect(inferActivityKindFromScenarioIds(["game-forklift-01"])).toBe("forklift_precheck");
    expect(inferActivityKindFromScenarioIds(["game-ppe-01"])).toBe("ppe_dress_up");
    expect(inferActivityKindFromScenarioIds(["game-sort-01"])).toBe("sorting_zone");
    expect(inferActivityKindFromScenarioIds(["game-stack-01"])).toBe("load_stacking");
    expect(inferActivityKindFromScenarioIds(["scenario-1", "game-ppe-01"])).toBe("decision");
    expect(inferActivityKindFromScenarioIds([])).toBe("decision");
  });

  it("uses stable prefixes for each mini-game kind", () => {
    expect(miniGameScenarioPrefix("forklift_precheck")).toBe("game-forklift");
    expect(miniGameScenarioPrefix("ppe_dress_up")).toBe("game-ppe");
    expect(miniGameScenarioPrefix("sorting_zone")).toBe("game-sort");
    expect(miniGameScenarioPrefix("load_stacking")).toBe("game-stack");
  });
});
