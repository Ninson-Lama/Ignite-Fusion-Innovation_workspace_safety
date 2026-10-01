import { describe, expect, it } from "vitest";
import { CORE_MODULES, HAZARDS, getTrainingModule } from "@/lib/training-data";

describe("core training catalogue", () => {
  it("contains the four available core modules", () => {
    expect(CORE_MODULES.map((module) => module.slug)).toEqual([
      "hazard-perception",
      "manual-handling",
      "working-at-height",
      "cyber-awareness",
    ]);
  });

  it("provides five decisions for each practical scenario module", () => {
    expect(getTrainingModule("manual-handling")?.activities).toHaveLength(5);
    expect(getTrainingModule("working-at-height")?.activities).toHaveLength(5);
    expect(getTrainingModule("cyber-awareness")?.activities).toHaveLength(5);
  });

  it("contains seven unique required hazards with corrective action", () => {
    expect(HAZARDS).toHaveLength(7);
    expect(new Set(HAZARDS.map((hazard) => hazard.id)).size).toBe(7);
    expect(HAZARDS.every((hazard) => hazard.risk && hazard.consequence && hazard.correctiveAction)).toBe(true);
  });
});
