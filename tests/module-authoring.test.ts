import { describe, expect, it } from "vitest";
import {
  getAuthoringReadiness,
  moduleAuthoringDefinitionSchema,
  parseAuthoredPublicContent,
  type ModuleAuthoringDefinition,
} from "@/lib/module-authoring";
import { createStarterAuthoringDefinition } from "@/lib/server/module-authoring-starter";

function completeDefinition(): ModuleAuthoringDefinition {
  return {
    title: "Lockout and tagout essentials",
    slug: "lockout-tagout-essentials",
    description: "Learn how to isolate workplace energy before inspection or maintenance begins.",
    overview: "This module teaches a repeatable isolation, verification and reporting routine for warehouse equipment.",
    category: "Operational safety",
    estimatedMinutes: 25,
    difficulty: "intermediate",
    passMark: 80,
    pointsAvailable: 200,
    sortOrder: 50,
    heroImagePath: "/training-hazard-perception.png",
    activityKind: "decision",
    learningObjectives: ["Recognise hazardous energy sources", "Select a safe isolation sequence"],
    learning: [
      { id: "section-1", title: "Plan the isolation", summary: "Identify every energy source before work begins.", points: ["Review the equipment instructions", "Agree the isolation boundary"] },
      { id: "section-2", title: "Verify the safe state", summary: "Confirm that stored and supplied energy is controlled.", points: ["Test using the approved method", "Report any failed isolation"] },
    ],
    scenarios: [{
      id: "scenario-1",
      situation: "A conveyor has stopped with a component trapped near its guarded drive.",
      prompt: "What should happen before the guard is opened?",
      choices: [
        { id: "a", label: "Isolate and verify every energy source", feedback: "Correct. Verification must happen before access begins.", isCorrect: true },
        { id: "b", label: "Use the stop button and open the guard", feedback: "A stop control does not prove that hazardous energy is isolated.", isCorrect: false },
      ],
    }],
    questions: [1, 2, 3].map((index) => ({
      id: `00000000-0000-4000-8000-00000000000${index}`,
      questionType: "single_choice" as const,
      prompt: `Which control is required before equipment access ${index}?`,
      explanation: "Isolation and verification are required before entering the danger area.",
      points: 1,
      options: [
        { id: "a", label: "Isolate and verify", isCorrect: true },
        { id: "b", label: "Use only the stop button", isCorrect: false },
      ],
    })),
  };
}

describe("module authoring", () => {
  it("creates a valid private starter definition that is not publish-ready", () => {
    const starter = createStarterAuthoringDefinition({
      title: "Lockout and tagout essentials",
      slug: "lockout-tagout-essentials",
      description: "Learn how to isolate workplace energy before inspection or maintenance begins.",
      overview: "This module teaches a repeatable isolation, verification and reporting routine for warehouse equipment.",
      category: "Operational safety",
      estimatedMinutes: 25,
      difficulty: "intermediate",
      passMark: 80,
      pointsAvailable: 200,
      sortOrder: 50,
      learningObjectives: ["Recognise hazardous energy sources", "Select a safe isolation sequence"],
    });
    expect(moduleAuthoringDefinitionSchema.safeParse(starter).success).toBe(true);
    expect(starter.activityKind).toBe("decision");
    expect(starter.scenarios).toEqual([]);
    expect(getAuthoringReadiness(starter).ready).toBe(false);
  });

  it("creates a mini-game starter with independent, publishable practice rounds", () => {
    const starter = createStarterAuthoringDefinition({
      title: "Hazardous material sorting",
      slug: "hazardous-material-sorting",
      description: "Sort workplace materials into their appropriate controlled storage zones.",
      overview: "This module teaches trainees to recognise labels and select compatible storage or quarantine routes.",
      category: "Hazardous materials",
      estimatedMinutes: 20,
      difficulty: "introductory",
      passMark: 80,
      pointsAvailable: 200,
      sortOrder: 60,
      learningObjectives: ["Recognise common material classes", "Select the correct controlled destination"],
      activityKind: "sorting_zone",
    });

    expect(starter.activityKind).toBe("sorting_zone");
    expect(starter.scenarios.length).toBeGreaterThan(0);
    expect(starter.scenarios.map((scenario) => scenario.id)).toEqual(["play-sorting-v1"]);
    expect(getAuthoringReadiness(starter)).toMatchObject({
      ready: false,
      steps: { practice: true },
    });
  });

  it("defaults legacy private definitions to decision activities and rejects unknown kinds", () => {
    const legacyDefinition: Partial<ModuleAuthoringDefinition> = { ...completeDefinition() };
    delete legacyDefinition.activityKind;
    const parsed = moduleAuthoringDefinitionSchema.safeParse(legacyDefinition);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.activityKind).toBe("decision");

    expect(moduleAuthoringDefinitionSchema.safeParse({
      ...completeDefinition(),
      activityKind: "untrusted_game",
    }).success).toBe(false);
  });

  it("requires complete learning, practice and assessment content before publishing", () => {
    const definition = completeDefinition();
    expect(getAuthoringReadiness(definition)).toMatchObject({
      ready: true,
      steps: { overview: true, learning: true, practice: true, assessment: true },
    });
  });

  it("accepts a strict module-owned uploaded cover key", () => {
    const definition = completeDefinition();
    definition.heroImagePath = "8e857976-1365-49ad-ad18-8ce1f7bd1af6/e1d57bdc-4721-4f8e-b439-5096b7a86f5d.webp";
    expect(moduleAuthoringDefinitionSchema.safeParse(definition).success).toBe(true);
  });

  it("rejects remote URLs and unsafe uploaded cover keys", () => {
    const definition = completeDefinition();
    for (const heroImagePath of [
      "https://example.com/cover.webp",
      "8e857976-1365-49ad-ad18-8ce1f7bd1af6/../cover.webp",
      "8e857976-1365-49ad-ad18-8ce1f7bd1af6/not-a-uuid.webp",
    ]) {
      expect(moduleAuthoringDefinitionSchema.safeParse({ ...definition, heroImagePath }).success).toBe(false);
    }
  });

  it("blocks a scenario with more than one safest answer", () => {
    const definition = completeDefinition();
    definition.scenarios[0].choices[1].isCorrect = true;
    const readiness = getAuthoringReadiness(definition);
    expect(readiness.ready).toBe(false);
    expect(readiness.blockers.join(" ")).toContain("exactly one safest answer");
  });

  it("uses mini-game language when a game round is incomplete", () => {
    const definition = completeDefinition();
    definition.activityKind = "ppe_dress_up";
    definition.scenarios = [];
    const readiness = getAuthoringReadiness(definition);
    expect(readiness.ready).toBe(false);
    expect(readiness.blockers).toContain("Add at least one game round.");
  });

  it("strips answer-revealing properties from trainee-safe public content", () => {
    const parsed = parseAuthoredPublicContent({
      schemaVersion: 1,
      learning: [{ id: "section-1", title: "Plan", summary: "Review the complete task.", points: ["Check the work area"] }],
      scenarios: [{ id: "scenario-1", situation: "A workplace situation", prompt: "What happens next?", choices: [{ id: "a", label: "Safe action", isCorrect: true, feedback: "Secret feedback" }] }],
    });
    expect(parsed).not.toBeNull();
    expect(parsed?.activityKind).toBe("decision");
    expect(parsed?.scenarios[0].choices[0]).toEqual({ id: "a", label: "Safe action" });
  });

  it("infers mini-game presentation for legacy version-one public content", () => {
    const parsed = parseAuthoredPublicContent({
      schemaVersion: 1,
      learning: [],
      scenarios: [{
        id: "game-forklift-01",
        situation: "A tyre has a visible safety-critical defect.",
        prompt: "How should this check be recorded?",
        choices: [{ id: "fail", label: "Fail and report" }],
      }],
    });
    expect(parsed?.activityKind).toBe("forklift_precheck");
  });

  it("accepts validated version-two activity metadata and strips private fields", () => {
    const parsed = parseAuthoredPublicContent({
      schemaVersion: 2,
      activityKind: "load_stacking",
      learning: [],
      scenarios: [{
        id: "game-stack-01",
        situation: "A heavy stable pallet is ready for a rated rack bay.",
        prompt: "Where should this load be placed?",
        choices: [{ id: "bottom", label: "Lowest suitable level", isCorrect: true, feedback: "Private feedback" }],
      }],
    });
    expect(parsed?.activityKind).toBe("load_stacking");
    expect(parsed?.scenarios[0].choices[0]).toEqual({ id: "bottom", label: "Lowest suitable level" });

    expect(parseAuthoredPublicContent({
      schemaVersion: 2,
      activityKind: "physics_from_client",
      learning: [],
      scenarios: [],
    })).toBeNull();
  });
});
