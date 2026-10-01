import { describe, expect, it } from "vitest";
import { activityDetail, normaliseAdminEvent } from "@/lib/admin-activity";

describe("administrator activity projection", () => {
  it("formats game, quiz and progress details without exposing raw metadata", () => {
    expect(activityDetail("game_completed", { score: 75 })).toBe("Game score: 75%");
    expect(activityDetail("quiz_completed", { percentage: 92, passed: true })).toBe("92% · Passed");
    expect(activityDetail("progress_updated", { percentage: 40 })).toBe("40% of module completed");
    expect(activityDetail("progress_updated", { progressPercent: 55 })).toBe("55% of module completed");
  });

  it("normalises display fields and categorises only actual games as games", () => {
    const event = normaliseAdminEvent({
      id: "1", event_type: "activity_completed", subject_name: "A trainee",
      module_title: "Forklift Simulator", metadata: { correct: true, activityKind: "forklift_precheck" }, created_at: "2026-09-09T12:00:00Z",
    });
    expect(event).toMatchObject({ subject: "A trainee", moduleTitle: "Forklift Simulator", category: "games", detail: "Safer decision recorded" });
    expect(event).not.toHaveProperty("metadata");
    expect(normaliseAdminEvent({ id: "2", event_type: "activity_completed", metadata: { correct: true } }).category).toBe("training");
  });
});
