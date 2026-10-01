import { describe, expect, it } from "vitest";
import { hasPassed, isModuleComplete, overallProgress, percentage, uniqueHazardPoints } from "@/lib/scoring";

describe("Safety360 scoring", () => {
  it("calculates bounded whole percentages", () => {
    expect(percentage(7, 10)).toBe(70);
    expect(percentage(15, 10)).toBe(100);
    expect(percentage(-2, 10)).toBe(0);
    expect(percentage(2, 0)).toBe(0);
  });

  it("uses the 70 percent project pass threshold", () => {
    expect(hasPassed(7, 10)).toBe(true);
    expect(hasPassed(69, 100)).toBe(false);
  });

  it("calculates overall progress from the active pathway", () => {
    expect(overallProgress(0, 3)).toBe(0);
    expect(overallProgress(2, 3)).toBe(67);
    expect(overallProgress(3, 3)).toBe(100);
  });

  it("awards each unique hazard once", () => {
    expect(uniqueHazardPoints(["h1", "h1", "h2"])).toBe(200);
  });

  it("requires learning, activity and a passing quiz for completion", () => {
    expect(isModuleComplete({ learningComplete: true, activityComplete: true, bestQuizPercentage: 70 })).toBe(true);
    expect(isModuleComplete({ learningComplete: true, activityComplete: false, bestQuizPercentage: 100 })).toBe(false);
    expect(isModuleComplete({ learningComplete: true, activityComplete: true, bestQuizPercentage: 69 })).toBe(false);
  });
});
