import { describe, expect, it } from "vitest";
import {
  getTrainingResumeHref,
  getTrainingResumeLabel,
  learningSectionPosition,
} from "@/lib/training-resume";

describe("training resume navigation", () => {
  it("returns the correct route for each saved stage", () => {
    expect(getTrainingResumeHref("manual-handling", { stage: "overview", position: 0 })).toBe("/training/manual-handling");
    expect(getTrainingResumeHref("manual-handling", { stage: "learning", position: 50 })).toBe("/training/manual-handling#learning-50");
    expect(getTrainingResumeHref("manual-handling", { stage: "activity", position: 50 })).toBe("/training/manual-handling/activity");
    expect(getTrainingResumeHref("hazard-perception", { stage: "activity", position: 20 })).toBe("/training/hazard-perception/scene");
    expect(getTrainingResumeHref("manual-handling", { stage: "quiz", position: 25 })).toBe("/training/manual-handling/quiz");
  });

  it("uses clear action labels for saved progress", () => {
    expect(getTrainingResumeLabel("overview", 0)).toBe("View module");
    expect(getTrainingResumeLabel("learning", 25)).toBe("Continue learning");
    expect(getTrainingResumeLabel("activity", 60)).toBe("Resume activity");
    expect(getTrainingResumeLabel("quiz", 80)).toBe("Resume knowledge check");
    expect(getTrainingResumeLabel("completed", 100)).toBe("Review module");
  });

  it("creates stable section checkpoints across a learning grid", () => {
    expect([0, 1, 2].map((index) => learningSectionPosition(index, 3))).toEqual([33, 67, 100]);
    expect(learningSectionPosition(0, 0)).toBe(0);
  });
});
