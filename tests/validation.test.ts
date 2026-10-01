import { describe, expect, it } from "vitest";
import {
  activityCompletionSchema,
  moduleSlugSchema,
  notificationReadSchema,
  quizSubmissionSchema,
  trainingCheckpointSchema,
} from "@/lib/validation";

describe("boundary validation", () => {
  const moduleId = "00000000-0000-4000-8000-000000000010";

  it("accepts safe authored slugs and rejects malformed routes", () => {
    expect(moduleSlugSchema.safeParse("lockout-tagout-essentials").success).toBe(true);
    expect(moduleSlugSchema.safeParse("Made Up Module").success).toBe(false);
  });

  it("requires a recognised hazard id for hazard scene records", () => {
    expect(activityCompletionSchema.safeParse({ moduleId, moduleSlug: "hazard-perception" }).success).toBe(false);
    expect(activityCompletionSchema.safeParse({ moduleId, moduleSlug: "hazard-perception", hazardId: "liquid-spill" }).success).toBe(true);
  });

  it("accepts bounded decision scenario and choice identifiers for authored modules", () => {
    expect(activityCompletionSchema.safeParse({ moduleId, moduleSlug: "manual-handling", scenarioId: "mh-1", selectedChoiceId: "b" }).success).toBe(true);
    expect(activityCompletionSchema.safeParse({ moduleId, moduleSlug: "lockout-tagout-essentials", scenarioId: "scenario-1", selectedChoiceId: "choice_a" }).success).toBe(true);
    expect(activityCompletionSchema.safeParse({ moduleId, moduleSlug: "lockout-tagout-essentials", scenarioId: "Scenario 1", selectedChoiceId: "a" }).success).toBe(false);
    expect(activityCompletionSchema.safeParse({ moduleId, moduleSlug: "lockout-tagout-essentials", scenarioId: "scenario-1", selectedChoiceId: "A choice" }).success).toBe(false);
  });

  it("accepts a bounded array-based quiz submission", () => {
    const result = quizSubmissionSchema.safeParse({
      moduleId,
      answers: { "00000000-0000-4000-8000-000000000001": ["a", "b"] },
    });
    expect(result.success).toBe(true);
  });

  it("rejects scalar quiz answers because trusted scoring expects arrays", () => {
    const result = quizSubmissionSchema.safeParse({
      moduleId,
      answers: { "00000000-0000-4000-8000-000000000001": "a" },
    });
    expect(result.success).toBe(false);
  });

  it("requires a UUID module identifier", () => {
    expect(activityCompletionSchema.safeParse({
      moduleId: "manual-handling",
      moduleSlug: "manual-handling",
      scenarioId: "mh-1",
      selectedChoiceId: "b",
    }).success).toBe(false);
  });

  it("accepts bounded trainee checkpoints and rejects completed client stages", () => {
    expect(trainingCheckpointSchema.safeParse({ moduleId, stage: "learning", position: 67 }).success).toBe(true);
    expect(trainingCheckpointSchema.safeParse({ moduleId, stage: "completed", position: 100 }).success).toBe(false);
    expect(trainingCheckpointSchema.safeParse({ moduleId, stage: "activity", position: 101 }).success).toBe(false);
  });

  it("limits notification updates to valid assignment identifiers", () => {
    expect(notificationReadSchema.safeParse({ ids: [moduleId] }).success).toBe(true);
    expect(notificationReadSchema.safeParse({ ids: ["not-an-id"] }).success).toBe(false);
    expect(notificationReadSchema.safeParse({ ids: Array.from({ length: 51 }, () => moduleId) }).success).toBe(false);
  });
});
