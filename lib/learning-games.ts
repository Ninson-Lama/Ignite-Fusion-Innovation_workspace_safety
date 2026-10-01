import type { MiniGameActivityKind } from "@/lib/mini-games";

export const GAME_IDS = ["forklift", "ppe", "sorting", "stacking"] as const;
export type GameId = typeof GAME_IDS[number];
export const GAME_KINDS: Record<GameId, MiniGameActivityKind> = { forklift: "forklift_precheck", ppe: "ppe_dress_up", sorting: "sorting_zone", stacking: "load_stacking" };
export const GAME_NAMES: Record<GameId, string> = { forklift: "Forklift Simulator", ppe: "PPE Dress-Up", sorting: "Sorting Zone", stacking: "Load Stacking Challenge" };
export function interactiveGameId(scenarios: readonly { id: string }[]): GameId | null {
  return scenarios.length === 1 ? GAME_IDS.find((id) => scenarios[0].id === `play-${id}-v1`) ?? null : null;
}
export interface LearningGameState { moves: string[]; placements: Record<string, string> }
export const emptyGame = (): LearningGameState => ({ moves: [], placements: {} });

export const PPE_ITEMS = [
  ["hat", "Hard hat"], ["boots", "Safety boots"], ["vest", "Hi-vis vest"], ["ears", "Hearing protection"],
  ["goggles", "Splash goggles"], ["face", "Face shield"], ["gloves", "Task-approved chemical gloves"], ["apron", "Chemical apron"],
] as const;
export const PPE_SCENES = [
  { id: "entry", title: "Warehouse entry", text: "The site assessment requires head, foot, visibility and hearing protection: overhead handling, vehicle traffic and a signed high-noise zone.", required: ["hat", "boots", "vest", "ears"] },
  { id: "splash", title: "Assessed splash task", text: "An authorised task assessment specifies splash goggles AND a face shield, chemical-resistant gloves selected for the substance, an apron and safety boots. Equip only this task's required kit.", required: ["goggles", "face", "gloves", "apron", "boots"] },
  { id: "walk", title: "Segregated picking route", text: "This exercise's pedestrian route is physically segregated, with no overhead or noise exposure. Site rules specify hi-vis and safety boots. Keep the barrier in place.", required: ["boots", "vest"] },
] as const;
export const SORT_BINS = [["stock", "Approved stock"], ["hold", "Stock hold / verification"], ["flammable", "Flammable cabinet"], ["oxidizer", "Oxidizer store"], ["recycle", "Clean cardboard recycling"], ["incident", "STOP · isolate people & report"]] as const;
export const SORT_CARDS = [
  { id: "order", label: "Sealed parts · labels and purchase order match", bin: "stock" },
  { id: "mismatch", label: "Part number does not match the receiving record", bin: "hold" },
  { id: "solvent", label: "Sealed flammable solvent · SDS specifies approved cabinet", bin: "flammable" },
  { id: "oxidizer", label: "Undamaged oxidizer · designated compatible store", bin: "oxidizer" },
  { id: "carton", label: "Clean, dry, empty cardboard carton", bin: "recycle" },
  { id: "battery", label: "Damaged lithium battery · warm and swelling (do not move it)", bin: "incident" },
] as const;
export const LOADS = [
  { id: "motor", label: "Motors", weight: 600, damaged: false },
  { id: "parts", label: "Metal parts", weight: 400, damaged: false },
  { id: "boxes", label: "Cartons", weight: 250, damaged: false },
  { id: "foam", label: "Foam packaging", weight: 100, damaged: false },
  { id: "broken", label: "Split pallet · leaning", weight: 300, damaged: true },
] as const;
export const RACK_SLOTS = ["a0", "a1", "a2", "b0", "b1", "b2", "hold"] as const;
export const WALLS = ["1,1", "1,2", "5,1", "5,2"];
export const DRIVE_ACTIONS = ["up", "down", "left", "right", "brake", "forks", "horn", "yield", "pickup", "drop"] as const;
export function replayDrive(moves: string[]) {
  let x = 0, y = 4, brake = true, raised = false, horn = false, yielded = false, load = false, delivered = false, faults = 0;
  let message = "Collect the load at (1,1), deliver to (7,1), then park at (7,5).";
  for (const action of moves) {
    if (action === "brake") { brake = !brake; message = `Parking brake ${brake ? "on" : "off"}.`; }
    else if (action === "forks") { if (!brake) { faults++; message = "Stop and apply the brake before adjusting forks in this exercise."; } else { raised = !raised; message = `Forks ${raised ? "raised — lower before travel" : "in travel position"}.`; } }
    else if (action === "horn") { horn = x === 2 || x === 4; message = horn ? "Horn sounded at the blind crossing." : "Approach the marked crossing before sounding the horn."; }
    else if (action === "yield") { yielded = brake && (x === 2 || x === 4); message = yielded ? "Stopped, checked both ways and yielded. Crossing is clear." : "Stop beside the crossing and apply the brake to check for people."; }
    else if (action === "pickup" || action === "drop") {
      const valid = brake && !raised && y === 0 && (action === "pickup" ? x === 0 && !load && !delivered : x === 6 && load);
      if (!valid) { faults++; message = "Use the correct loading bay with brake on and forks lowered."; }
      else { load = action === "pickup"; delivered = action === "drop"; message = load ? "Load secured. Keep a clear view and travel slowly." : "Load delivered. Return to the parking bay."; }
    } else {
      const nx = x + (action === "left" ? -1 : action === "right" ? 1 : 0), ny = y + (action === "up" ? -1 : action === "down" ? 1 : 0);
      if (brake || raised || nx < 0 || nx > 6 || ny < 0 || ny > 4 || WALLS.includes(`${nx},${ny}`) || (nx === 3 && x !== 3 && (!horn || !yielded))) {
        faults++; message = brake ? "Release the brake before moving." : raised ? "Lower forks before travel." : nx === 3 && (!horn || !yielded) ? "Stop, check for people and sound the horn before entering this blind crossing." : "Route blocked. Keep clear of racking and boundaries.";
      } else { x = nx; y = ny; if (x !== 3) { horn = false; yielded = false; } message = "Moving at the exercise's controlled walking pace."; }
    }
  }
  return { x, y, brake, raised, load, delivered, faults, message, complete: delivered && x === 6 && y === 4 && brake && !raised };
}
export function gameReview(id: GameId, state: LearningGameState): { score: number; complete: boolean; feedback: string[] } {
  const p = state.placements;
  if (id === "forklift") { const d = replayDrive(state.moves); return { score: Math.max(0, 100 - d.faults * 10), complete: d.complete, feedback: [d.complete ? `Route complete. ${d.faults} unsafe or blocked control attempts.` : d.message] }; }
  if (id === "ppe") {
    const feedback = PPE_SCENES.map((scene) => {
      const chosen = PPE_ITEMS.filter(([item]) => p[`${scene.id}:${item}`] === "equipped").map(([item]) => item as string);
      return chosen.length === scene.required.length && scene.required.every((item) => chosen.includes(item)) ? `${scene.title}: kit matches the assessment.` : `${scene.title}: review the listed protection requirements; add missing items and remove extras.`;
    });
    return { complete: PPE_SCENES.every((scene) => PPE_ITEMS.some(([item]) => p[`${scene.id}:${item}`] === "equipped")), score: Math.round(feedback.filter((f) => f.includes("matches")).length / 3 * 100), feedback };
  }
  if (id === "sorting") return { complete: SORT_CARDS.every((card) => !!p[card.id]), score: Math.round(SORT_CARDS.filter((card) => p[card.id] === card.bin).length / SORT_CARDS.length * 100), feedback: SORT_CARDS.filter((card) => p[card.id] !== card.bin).map((card) => `${card.label}: use ${SORT_BINS.find(([bin]) => bin === card.bin)?.[1]}.`) };
  const feedback: string[] = [];
  for (const load of LOADS) if (!p[load.id]) feedback.push(`Place ${load.label}.`); else if (load.damaged !== (p[load.id] === "hold")) feedback.push(`${load.label}: damaged loads go to hold; sound loads belong in a rated slot.`);
  for (const bay of ["a", "b"]) {
    const placed = LOADS.filter((load) => p[load.id]?.startsWith(bay));
    if (placed.reduce((sum, load) => sum + load.weight, 0) > 900) feedback.push(`Bay ${bay.toUpperCase()}: exceeds the exercise's 900 kg total rating.`);
    for (let level = 0; level < 3; level++) {
      const here = placed.filter((load) => p[load.id] === `${bay}${level}`);
      if (here.length > 1 || here.some((load) => load.weight > [700, 450, 200][level])) feedback.push(`Bay ${bay.toUpperCase()}, level ${level + 1}: one pallet per slot; respect its rating.`);
      if (level > 0 && here.length) {
        const belowWeight = Math.max(0, ...placed.filter((load) => p[load.id] === `${bay}${level - 1}`).map((load) => load.weight));
        if (!belowWeight || belowWeight < Math.max(...here.map((load) => load.weight))) feedback.push(`Bay ${bay.toUpperCase()}: follow this loading plan bottom-up, heaviest low.`);
      }
    }
  }
  return { complete: LOADS.every((load) => !!p[load.id]), score: Math.max(0, 100 - feedback.length * 20), feedback: feedback.length ? feedback : ["Stable plan: loads within slot and bay limits; damaged pallet held for assessment."] };
}
