import type { MiniGameActivityKind } from "@/lib/mini-games";
import { GAME_IDS, GAME_KINDS, GAME_NAMES } from "@/lib/learning-games";

export interface MiniGameScenarioSeed {
  id: string;
  situation: string;
  prompt: string;
  choices: Array<{
    id: string;
    label: string;
    feedback: string;
    isCorrect: boolean;
  }>;
}

// Import only from server routes; template answer keys must not enter client bundles.
const PRIVATE_GAME_ROUNDS: Record<MiniGameActivityKind, readonly MiniGameScenarioSeed[]> = {
  forklift_precheck: [
      {
        id: "game-forklift-01",
        situation: "The front-left tyre has a deep sidewall cut and a visible section of reinforcement.",
        prompt: "How should this tyre be recorded before the shift?",
        choices: [
          { id: "pass", label: "Pass — normal wear", feedback: "A deep cut can cause sudden tyre failure and must not be accepted as normal wear.", isCorrect: false },
          { id: "fail", label: "Fail — isolate the truck and report the defect", feedback: "Correct. The truck must remain out of service until the tyre is assessed and repaired through the approved process.", isCorrect: true },
          { id: "monitor", label: "Use for this shift and monitor it", feedback: "Monitoring does not control a safety-critical tyre defect while the truck is operating.", isCorrect: false },
        ],
      },
      {
        id: "game-forklift-02",
        situation: "One fork has a visible crack at the heel where the blade meets the shank.",
        prompt: "What is the correct pre-use decision?",
        choices: [
          { id: "pass", label: "Pass if the load will be light", feedback: "A reduced load does not make a cracked fork safe to use.", isCorrect: false },
          { id: "fail", label: "Fail — remove the forklift from service", feedback: "Correct. A cracked fork is a structural defect requiring immediate isolation and reporting.", isCorrect: true },
          { id: "note", label: "Record it after completing the first task", feedback: "The defect must be controlled before the truck is used, not after the first task.", isCorrect: false },
        ],
      },
      {
        id: "game-forklift-03",
        situation: "A small pool of hydraulic fluid is visible beneath the mast and the hose above it is wet.",
        prompt: "Which inspection result is appropriate?",
        choices: [
          { id: "wipe", label: "Wipe it clean and continue the check", feedback: "Cleaning alone hides evidence and does not control the leak or loss of hydraulic performance.", isCorrect: false },
          { id: "fail", label: "Fail — isolate, contain and report the leak", feedback: "Correct. Prevent use, control the spill and have the hydraulic system examined by an authorised person.", isCorrect: true },
          { id: "pass", label: "Pass because the reservoir is still full", feedback: "Fluid level does not make an active leak acceptable.", isCorrect: false },
        ],
      },
      {
        id: "game-forklift-04",
        situation: "The horn works, but the reversing warning and one front work light do not operate.",
        prompt: "Can the forklift begin work in the warehouse?",
        choices: [
          { id: "yes", label: "Yes — the horn provides enough warning", feedback: "The required warning and lighting systems must all work for the intended operating area.", isCorrect: false },
          { id: "daylight", label: "Yes — but only during daylight", feedback: "Indoor traffic controls and visibility requirements still apply during daylight hours.", isCorrect: false },
          { id: "no", label: "No — record the defects and keep it out of service", feedback: "Correct. Missing warning or visibility equipment must be resolved before operation.", isCorrect: true },
        ],
      },
  ],
  ppe_dress_up: [
      {
        id: "game-ppe-01",
        situation: "A trainee is entering a signed high-noise picking zone with overhead handling activity and vehicle movement.",
        prompt: "Which site PPE kit is complete for entry?",
        choices: [
          { id: "kit-a", label: "Hi-vis vest and trainers", feedback: "This misses the required head, foot and hearing protection.", isCorrect: false },
          { id: "kit-b", label: "Hard hat, safety footwear, hi-vis and hearing protection", feedback: "Correct. This kit matches the stated overhead, vehicle and noise exposures.", isCorrect: true },
          { id: "kit-c", label: "Safety glasses and disposable gloves", feedback: "Those items do not address the stated overhead, traffic, foot and noise risks.", isCorrect: false },
        ],
      },
      {
        id: "game-ppe-02",
        situation: "A trained worker is topping up a lead-acid battery in the designated charging area under the approved procedure.",
        prompt: "Which task-specific PPE should be selected?",
        choices: [
          { id: "kit-a", label: "Chemical splash eye and face protection, suitable gloves and apron", feedback: "Correct. The selected PPE protects against the identified electrolyte splash exposure.", isCorrect: true },
          { id: "kit-b", label: "Dust mask and hearing protection only", feedback: "These do not protect the eyes, face, hands or body from electrolyte splash.", isCorrect: false },
          { id: "kit-c", label: "Ordinary work gloves and sunglasses", feedback: "Every item must be approved for the hazard; ordinary gloves and sunglasses are not suitable splash protection.", isCorrect: false },
        ],
      },
      {
        id: "game-ppe-03",
        situation: "A carton has leaked an unknown liquid in the aisle and the substance has not yet been identified.",
        prompt: "What should the trainee put on first?",
        choices: [
          { id: "kit-a", label: "Any available gloves, then clean it immediately", feedback: "Unknown substances require identification and the approved spill response before PPE can be selected safely.", isCorrect: false },
          { id: "kit-b", label: "No improvised kit — isolate the area and call the spill response", feedback: "Correct. PPE must follow the substance assessment and approved response; do not guess with an unknown liquid.", isCorrect: true },
          { id: "kit-c", label: "A high-visibility vest only", feedback: "High visibility does not protect against an unknown chemical exposure.", isCorrect: false },
        ],
      },
      {
        id: "game-ppe-04",
        situation: "A brief inspection is planned beside a pedestrian route, but the task can be completed from behind a fixed barrier.",
        prompt: "What is the best PPE decision?",
        choices: [
          { id: "kit-a", label: "Use the required site PPE and keep the barrier control in place", feedback: "Correct. PPE complements the stronger physical control rather than replacing it.", isCorrect: true },
          { id: "kit-b", label: "Remove the barrier because PPE is being worn", feedback: "PPE does not justify removing a stronger segregation control.", isCorrect: false },
          { id: "kit-c", label: "Wear extra PPE and stand in the route", feedback: "Additional PPE does not make an avoidable exposure to moving traffic acceptable.", isCorrect: false },
        ],
      },
  ],
  sorting_zone: [
      {
        id: "game-sort-01",
        situation: "A sealed, labelled container holds a flammable solvent awaiting approved storage.",
        prompt: "Which storage zone should receive this card?",
        choices: [
          { id: "flammable", label: "Approved flammable-liquids cabinet", feedback: "Correct. Keep the labelled solvent in the approved flammable storage zone and within local quantity limits.", isCorrect: true },
          { id: "oxidizer", label: "Oxidizer storage", feedback: "Flammables must be segregated from oxidizing substances.", isCorrect: false },
          { id: "general", label: "General consumables shelf", feedback: "A general shelf does not provide the required fire and segregation controls.", isCorrect: false },
        ],
      },
      {
        id: "game-sort-02",
        situation: "A container is clearly labelled as an oxidizing agent and its packaging is undamaged.",
        prompt: "Where should it be sorted?",
        choices: [
          { id: "flammable", label: "Beside flammable liquids", feedback: "Oxidizers can intensify fire and must be segregated from flammables.", isCorrect: false },
          { id: "oxidizer", label: "Designated oxidizer storage", feedback: "Correct. Use the designated compatible storage area and follow the safety data sheet.", isCorrect: true },
          { id: "drain", label: "Near the floor drain", feedback: "Drain proximity is not a storage control and may worsen an incident.", isCorrect: false },
        ],
      },
      {
        id: "game-sort-03",
        situation: "A lithium battery is swollen, warm and damaged after being struck by handling equipment.",
        prompt: "Which destination is correct?",
        choices: [
          { id: "returns", label: "Normal returns cage", feedback: "A damaged warm battery needs an emergency-safe response, not ordinary returns handling.", isCorrect: false },
          { id: "quarantine", label: "Approved battery quarantine and incident response", feedback: "Correct. Isolate people from the area and follow the site procedure for damaged lithium batteries.", isCorrect: true },
          { id: "waste", label: "General waste bin", feedback: "Damaged batteries must never enter general waste.", isCorrect: false },
        ],
      },
      {
        id: "game-sort-04",
        situation: "A machine has been stopped and the authorised isolation procedure is ready to begin.",
        prompt: "Which card comes before applying personal locks and tags?",
        choices: [
          { id: "identify", label: "Identify every energy source and notify affected people", feedback: "Correct. Understand the energy boundary and communicate before isolating and applying locks.", isCorrect: true },
          { id: "restart", label: "Attempt a normal restart", feedback: "A restart attempt belongs to verification after isolation, dissipation and lock application—not before them.", isCorrect: false },
          { id: "remove", label: "Remove another worker’s lock", feedback: "Never remove another person’s lock outside the authorised exceptional process.", isCorrect: false },
        ],
      },
  ],
  load_stacking: [
      {
        id: "game-stack-01",
        situation: "A dense 700 kg gearbox pallet is stable, undamaged and within the rack bay rating.",
        prompt: "Where should the heavy pallet be placed?",
        choices: [
          { id: "top", label: "Top level", feedback: "Placing the heaviest load high raises the centre of gravity and can conflict with the rack loading plan.", isCorrect: false },
          { id: "middle", label: "Middle level", feedback: "Use the lowest suitable rated level for the heaviest stable loads unless the engineered loading plan states otherwise.", isCorrect: false },
          { id: "bottom", label: "Lowest suitable rated level", feedback: "Correct. Keep the heaviest stable load low and within the posted bay and beam limits.", isCorrect: true },
        ],
      },
      {
        id: "game-stack-02",
        situation: "A pallet is leaning, one bearer is split and several cartons overhang the edge.",
        prompt: "Which rack position should receive it?",
        choices: [
          { id: "bottom", label: "Bottom level", feedback: "A low position does not correct damaged or unstable packaging.", isCorrect: false },
          { id: "quarantine", label: "No rack position — quarantine and rebuild", feedback: "Correct. Keep the load out of racking until it is stable, within profile and safe to handle.", isCorrect: true },
          { id: "top", label: "Top level away from pedestrians", feedback: "Height increases the consequence of collapse and does not make an unstable load safe.", isCorrect: false },
        ],
      },
      {
        id: "game-stack-03",
        situation: "The next pallet would keep each beam within its limit, but the total bay load would exceed the posted maximum.",
        prompt: "What is the correct move?",
        choices: [
          { id: "place", label: "Place it because the beam limit is acceptable", feedback: "Both beam and total bay limits must be respected.", isCorrect: false },
          { id: "replan", label: "Replan the location and keep the bay within its total rating", feedback: "Correct. The complete rack loading limit governs the decision, not only one beam.", isCorrect: true },
          { id: "split", label: "Place it halfway across two bays", feedback: "Loads must sit in an approved stable position; bridging bays is not an improvised capacity solution.", isCorrect: false },
        ],
      },
      {
        id: "game-stack-04",
        situation: "A light, stable carton pallet is shrink-wrapped, within profile and approved for the available upper level.",
        prompt: "Which placement follows the loading plan?",
        choices: [
          { id: "upper", label: "The rated upper level shown on the loading plan", feedback: "Correct. A light stable load can use the approved upper position when all rack and clearance limits are met.", isCorrect: true },
          { id: "aisle", label: "Temporarily in the pedestrian aisle", feedback: "A pedestrian route must remain clear even for temporary storage.", isCorrect: false },
          { id: "edge", label: "On the front edge for easier picking", feedback: "Loads must be fully and correctly supported, not left at the rack edge.", isCorrect: false },
        ],
      },
  ],
};

export function createMiniGameScenarios(kind: MiniGameActivityKind): MiniGameScenarioSeed[] {
  return PRIVATE_GAME_ROUNDS[kind].map((round) => ({
    ...round,
    choices: round.choices.map((choice) => ({ ...choice })),
  }));
}

// Versioned mission markers select an engine; legacy IDs keep their old meaning.
export function createInteractiveGameScenario(kind: MiniGameActivityKind): MiniGameScenarioSeed[] {
  const id = GAME_IDS.find((game) => GAME_KINDS[game] === kind)!;
  return [{ id: `play-${id}-v1`, situation: `Complete the ${GAME_NAMES[id]} interactive mission. Follow the exercise instructions and review your result.`,
    prompt: `Complete ${GAME_NAMES[id]}`, choices: [
      { id: "pass", label: "All safety rules met", feedback: "All exercise rules were met. Continue with the knowledge check.", isCorrect: true },
      { id: "review", label: "Review the game result", feedback: "Review the game feedback before continuing with the knowledge check.", isCorrect: false },
    ] }];
}
