import { describe, expect, it } from "vitest";
import { emptyGame, gameReview, interactiveGameId, PPE_SCENES, replayDrive, SORT_CARDS } from "@/lib/learning-games";
import { createInteractiveGameScenario } from "@/lib/server/mini-game-seeds";

const route = ["brake","up","up","up","up","brake","pickup","brake","right","right","brake","horn","yield","brake","right","right","right","right","brake","drop","brake","down","down","down","down","brake"];
describe("interactive mission rules", () => {
  it("only recognises versioned missions, leaving legacy and 360 unchanged", () => {
    expect(interactiveGameId(createInteractiveGameScenario("ppe_dress_up"))).toBe("ppe");
    expect(interactiveGameId([{ id: "game-ppe-01" }])).toBeNull();
    expect(interactiveGameId([{ id: "hazard-perception" }])).toBeNull();
  });
  it("replays a complete route and enforces crossing and travel controls", () => {
    expect(replayDrive(route)).toMatchObject({ complete: true, faults: 0, delivered: true });
    expect(replayDrive(route.filter((action) => action !== "horn")).complete).toBe(false);
    expect(replayDrive(["up"])).toMatchObject({ y: 4, faults: 1 });
    expect(replayDrive(["forks","brake","up"])).toMatchObject({ y: 4, faults: 1 });
    expect(replayDrive(["brake","right","up","up"])).toMatchObject({ x: 1, y: 3, faults: 1 });
  });
  it("requires all individual PPE items for each assessment, without extras", () => {
    const state = emptyGame();
    for (const scene of PPE_SCENES) for (const item of scene.required) state.placements[`${scene.id}:${item}`] = "equipped";
    expect(gameReview("ppe",state)).toMatchObject({ complete: true, score: 100 });
    state.placements["walk:hat"] = "equipped";
    expect(gameReview("ppe",state).score).toBe(67);
  });
  it("scores all six sorting cards, including a non-moving incident response", () => {
    const state = emptyGame();
    for (const card of SORT_CARDS) state.placements[card.id] = card.bin;
    expect(gameReview("sorting",state)).toMatchObject({ complete: true, score: 100 });
    state.placements.battery = "recycle";
    expect(gameReview("sorting",state).score).toBe(83);
  });
  it("evaluates the whole rack plan for weight, support and damaged stock", () => {
    const state = { moves: [], placements: { motor: "a0", parts: "b0", boxes: "a1", foam: "a2", broken: "hold" } };
    // The individual slots fit, but bay A totals 950 kg and is overloaded.
    expect(gameReview("stacking",state).score).toBe(80);
    state.placements.foam = "b1";
    expect(gameReview("stacking",state)).toMatchObject({ complete: true, score: 100 });
    state.placements.broken = "b2";
    expect(gameReview("stacking",state).score).toBeLessThan(100);
  });
  it("matches server scoring when multiple pallets occupy a lower slot", () => {
    expect(gameReview("stacking", { moves: [], placements: { motor: "b0", parts: "b1", boxes: "a1", foam: "a0", broken: "a0" } }).score).toBe(40);
  });
});
