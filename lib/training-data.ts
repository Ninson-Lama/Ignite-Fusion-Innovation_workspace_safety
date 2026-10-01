import type { HazardDefinition, TrainingModule } from "@/types";

export const MODULE_PREVIEWS: Record<TrainingModule["slug"], { src: string; alt: string }> = {
  "hazard-perception": {
    src: "/training-hazard-perception.png",
    alt: "Warehouse workers assessing an unstable box stack, a blocked aisle and an approaching forklift.",
  },
  "manual-handling": {
    src: "/training-manual-handling.png",
    alt: "Warehouse trainee using a stable stance to lift a carton safely from a pallet.",
  },
  "working-at-height": {
    src: "/training-working-at-height.png",
    alt: "Warehouse worker operating from a guarded elevated platform while a colleague controls the area below.",
  },
  "cyber-awareness": {
    src: "/training-cyber-awareness.png",
    alt: "Warehouse employee pausing at a workstation to assess a suspicious digital warning before using a handheld scanner.",
  },
};

export const CORE_MODULES: TrainingModule[] = [
  {
    slug: "hazard-perception",
    title: "Hazard Perception & Unsafe Acts",
    shortTitle: "Hazard Perception",
    description: "Enter an automotive warehouse, inspect the operation from every angle and identify seven safety-critical hazards before they develop into incidents.",
    category: "Operational safety",
    estimatedMinutes: 25,
    difficulty: "Intermediate",
    label: "Signature immersive module",
    visualClass: "module-visual-hazard",
    objectives: [
      "Recognise common hazards in a live warehouse operation",
      "Explain the risk and possible consequence of each unsafe condition",
      "Select practical corrective actions without creating further risk",
      "Build a repeatable scan-and-assess routine",
    ],
    learning: [
      { title: "Build a repeatable scan", summary: "Pause at the edge of the work area and inspect it in a consistent order before entering.", points: ["Scan near, middle and far areas", "Look from floor level to overhead storage", "Check escape routes, crossings and blind corners", "Repeat the scan whenever the operation changes"] },
      { title: "Read movement and interaction", summary: "Hazards often develop where pedestrians, vehicles, loads and equipment meet.", points: ["Use designated pedestrian routes and crossings", "Make sure the driver has stopped and acknowledged you", "Keep outside vehicle turning and load-swing zones", "Allow extra distance where visibility is restricted"] },
      { title: "Check storage and housekeeping", summary: "Small changes in condition can turn an ordinary aisle or storage area into a serious risk.", points: ["Identify spills, trailing leads and damaged surfaces", "Look for unstable or damaged stacked loads", "Keep fire points and emergency exits unobstructed", "Treat damaged racking as an immediate reporting priority"] },
      { title: "Control, report and verify", summary: "A useful observation ends with a proportionate action and confirmation that the risk is controlled.", points: ["Stop or isolate work where there is immediate danger", "Apply only controls you are trained and authorised to use", "Report the exact location, condition and people exposed", "Check that the agreed corrective action was completed"] },
    ],
    activities: [],
  },
  {
    slug: "manual-handling",
    title: "Manual Handling",
    shortTitle: "Manual Handling",
    description: "Use a simple assess–prepare–move routine to handle automotive components and workplace loads with more control.",
    category: "Physical safety",
    estimatedMinutes: 20,
    difficulty: "Foundation",
    label: "Core practical module",
    visualClass: "module-visual-manual",
    objectives: [
      "Assess the load, route, environment and personal capability",
      "Prepare a stable position before moving a load",
      "Use mechanical assistance and team lifts appropriately",
      "Set loads down under control and without trapping fingers",
    ],
    learning: [
      { title: "Assess the complete task", summary: "Use the task, individual, load and environment to decide whether the move can be completed safely.", points: ["Confirm weight, stability, shape and available handholds", "Consider your capability, training and any limitation", "Check the route, floor, doors, traffic and destination", "Pause and reassess whenever a condition changes"] },
      { title: "Prepare before the lift", summary: "Good preparation removes last-second adjustments while the load is already supported.", points: ["Clear the route and create space at the destination", "Position handling equipment before touching the load", "Plan team roles and agree one lifting command", "Wear the task-specific PPE required by local controls"] },
      { title: "Move with control", summary: "A stable posture and smooth movement reduce sudden load shifts and loss of balance.", points: ["Use a stable stance with the load close where practical", "Lift smoothly without jerking", "Turn by moving the feet instead of twisting", "Maintain a clear view or stop and change the method"] },
      { title: "Set down and review", summary: "The move is not complete until the load is stable and hands, feet and nearby people are clear.", points: ["Lower smoothly onto a prepared stable surface", "Keep fingers and feet away from pinch points", "Release the load before making small positional adjustments", "Report damaged packaging, unstable loads or handling aids"] },
    ],
    activities: [
      { id: "mh-1", number: "01", situation: "A sealed component crate has arrived without a visible weight label.", prompt: "What should you do first?", choices: [
        { id: "a", label: "Test-lift one corner quickly", isSafe: false, feedback: "A test lift can still overload you. Find the weight and handling information before committing." },
        { id: "b", label: "Check the label or handling record and assess the route", isSafe: true, feedback: "Correct. Confirm the load and route before choosing a handling method." },
        { id: "c", label: "Ask a colleague to watch while you lift", isSafe: false, feedback: "Observation does not reduce the load. Assess it and select suitable assistance." },
      ] },
      { id: "mh-2", number: "02", situation: "A dense gearbox casing must move from floor level to a workbench.", prompt: "Which approach gives the best control?", choices: [
        { id: "a", label: "Use the available lifting table and adjust it to bench height", isSafe: true, feedback: "Correct. Mechanical assistance removes much of the physical handling demand." },
        { id: "b", label: "Lift fast before it feels heavy", isSafe: false, feedback: "Speed reduces control and does not reduce the load." },
        { id: "c", label: "Pull it up using the edge of the bench", isSafe: false, feedback: "This creates poor grip, trapping and uncontrolled movement risks." },
      ] },
      { id: "mh-3", number: "03", situation: "You are carrying a medium crate and need to turn into a narrow aisle.", prompt: "How should you change direction?", choices: [
        { id: "a", label: "Keep your feet still and twist at the waist", isSafe: false, feedback: "Twisting under load increases strain. Move your feet to turn your whole body." },
        { id: "b", label: "Turn with small steps while keeping the load close", isSafe: true, feedback: "Correct. Move the feet and keep the trunk aligned with the load." },
        { id: "c", label: "Hold the crate away so you can see your feet", isSafe: false, feedback: "Holding the load away increases leverage and demand. Stop and improve visibility instead." },
      ] },
      { id: "mh-4", number: "04", situation: "A long awkward component can be lifted by two trained colleagues.", prompt: "What makes the team lift controlled?", choices: [
        { id: "a", label: "The taller person starts and the other follows", isSafe: false, feedback: "Uncoordinated movement makes the load unstable." },
        { id: "b", label: "Agree the route, roles and a single lifting command", isSafe: true, feedback: "Correct. Plan and communicate so both people move together." },
        { id: "c", label: "Both lift whenever they feel ready", isSafe: false, feedback: "Different start times can shift the load unexpectedly." },
      ] },
      { id: "mh-5", number: "05", situation: "The destination pallet is low and close to a rack upright.", prompt: "How should you set the load down?", choices: [
        { id: "a", label: "Lower smoothly, protect fingers, then adjust once released", isSafe: true, feedback: "Correct. Keep control and avoid making final adjustments while supporting the load." },
        { id: "b", label: "Drop the final few centimetres", isSafe: false, feedback: "Dropping can damage the item and create foot or hand injuries." },
        { id: "c", label: "Slide fingers underneath to centre it", isSafe: false, feedback: "This introduces a serious pinch point." },
      ] },
    ],
  },
  {
    slug: "working-at-height",
    title: "Working at Height",
    shortTitle: "Working at Height",
    description: "Choose, inspect and use access equipment safely while controlling falls, falling objects and the work area below.",
    category: "High-risk activity",
    estimatedMinutes: 22,
    difficulty: "Intermediate",
    label: "Core risk-control module",
    visualClass: "module-visual-height",
    objectives: [
      "Recognise when a task is work at height",
      "Choose suitable access equipment for the task and duration",
      "Inspect, position and use equipment without overreaching",
      "Protect people below and report defective equipment",
    ],
    learning: [
      { title: "Follow the control hierarchy", summary: "Start by deciding whether the task can be avoided, completed from ground level or redesigned.", points: ["Use ground-level scanning or extendable tools where suitable", "Bring work to a safe working height where practical", "Prevent a fall before relying on measures that only reduce harm", "Review the plan when the task or environment changes"] },
      { title: "Select suitable equipment", summary: "Equipment choice must reflect the task, duration, reach, surface and people involved.", points: ["Use a protected platform for longer or more complex work", "Check the rated capacity for the person, tools and materials", "Consider vehicle routes, doors and overhead obstructions", "Follow local authorisation and equipment procedures"] },
      { title: "Inspect and position", summary: "A pre-use check and stable setup are essential before anyone leaves the ground.", points: ["Inspect feet, steps, rails, locks and identification labels", "Remove defective equipment from service and report it", "Set up on a firm, level and clean surface", "Secure or stabilise equipment exactly as instructed"] },
      { title: "Work within the safe zone", summary: "Control the person at height, the objects being used and everyone who could enter below.", points: ["Keep your body within the designed working position", "Descend and reposition instead of overreaching", "Secure tools and materials against falling", "Create an effective exclusion zone and maintain emergency access"] },
    ],
    activities: [
      { id: "wh-1", number: "01", situation: "A label must be read on the lowest level of high racking for a two-minute check.", prompt: "What should happen before choosing equipment?", choices: [
        { id: "a", label: "Check whether the label can be read or scanned from ground level", isSafe: true, feedback: "Correct. Avoid work at height when a safe ground-level method is practical." },
        { id: "b", label: "Climb the first rack beam", isSafe: false, feedback: "Racking is not access equipment and must not be climbed." },
        { id: "c", label: "Stand on an empty component crate", isSafe: false, feedback: "Crates are unstable and not designed for access." },
      ] },
      { id: "wh-2", number: "02", situation: "A step ladder has a split foot and a damaged locking stay.", prompt: "What is the correct action?", choices: [
        { id: "a", label: "Use it only for a short task", isSafe: false, feedback: "Task duration does not make defective equipment safe." },
        { id: "b", label: "Tag it out, isolate it and report the defect", isSafe: true, feedback: "Correct. Prevent further use and follow the defect-reporting process." },
        { id: "c", label: "Ask someone to hold it", isSafe: false, feedback: "Holding does not repair damaged safety features." },
      ] },
      { id: "wh-3", number: "03", situation: "A sound step ladder rocks slightly on an uneven floor.", prompt: "How should it be made stable?", choices: [
        { id: "a", label: "Pack one foot with folded cardboard", isSafe: false, feedback: "Improvised packing can move or collapse." },
        { id: "b", label: "Move to a firm, level position or choose suitable equipment", isSafe: true, feedback: "Correct. Access equipment needs a stable supporting surface." },
        { id: "c", label: "Work faster while a colleague watches", isSafe: false, feedback: "Speed and observation do not correct instability." },
      ] },
      { id: "wh-4", number: "04", situation: "The item is just beyond comfortable reach from the platform.", prompt: "What should you do?", choices: [
        { id: "a", label: "Lean out while keeping one hand on the rail", isSafe: false, feedback: "Overreaching moves your centre of gravity beyond the safe working position." },
        { id: "b", label: "Descend and reposition the equipment", isSafe: true, feedback: "Correct. Reposition rather than stretching beyond a stable stance." },
        { id: "c", label: "Bounce the platform closer", isSafe: false, feedback: "Never move access equipment while occupied." },
      ] },
      { id: "wh-5", number: "05", situation: "Small tools are needed above a pedestrian picking route.", prompt: "Which control is essential?", choices: [
        { id: "a", label: "Ask pedestrians to look up", isSafe: false, feedback: "Warnings alone do not control falling-object risk." },
        { id: "b", label: "Segregate the area and secure loose tools", isSafe: true, feedback: "Correct. Control access below and prevent items from falling." },
        { id: "c", label: "Place a cone directly beneath you", isSafe: false, feedback: "A single cone rarely provides an adequate exclusion zone." },
      ] },
    ],
  },
  {
    slug: "cyber-awareness",
    title: "Cyber Awareness",
    shortTitle: "Cyber Awareness",
    description: "Protect operational accounts, devices and data by recognising suspicious requests, making safer digital decisions and reporting concerns quickly.",
    category: "Digital safety",
    estimatedMinutes: 25,
    difficulty: "Foundation",
    label: "Core digital safety module",
    visualClass: "module-visual-cyber",
    objectives: [
      "Recognise common phishing and social-engineering warning signs",
      "Protect passwords, multi-factor authentication prompts and shared devices",
      "Handle links, attachments, removable media and operational data safely",
      "Report suspicious activity quickly without destroying useful evidence",
    ],
    learning: [
      { title: "Pause before you trust", summary: "Urgency, authority and curiosity are often used to make a suspicious request feel routine.", points: ["Check the real sender address, not only the display name", "Treat unexpected links, attachments and QR codes as untrusted", "Verify unusual payment, password or data requests through a separate trusted channel", "Stop when a message pressures you to bypass the normal process"] },
      { title: "Protect identity and access", summary: "Your account proves who performed an action, so its password and approval prompts must remain personal.", points: ["Use a unique password or the approved password manager", "Never share a password, badge, access token or verification code", "Reject and report an MFA prompt you did not initiate", "Lock the screen whenever you leave a shared workstation"] },
      { title: "Handle devices and data safely", summary: "Warehouse scanners, workstations and removable media can expose operational and personal information.", points: ["Use only authorised devices, software and storage locations", "Do not connect an unknown USB drive or charging cable", "Confirm recipients before sending sensitive information", "Keep screens, printed records and portable devices protected from unauthorised access"] },
      { title: "Report quickly and preserve evidence", summary: "Early reporting gives the responsible team time to contain a problem and protect other people.", points: ["Stop interacting with the suspicious message or device", "Use the approved reporting route and describe exactly what happened", "Preserve the message, time and device details unless instructed otherwise", "If you clicked or entered information, report it immediately instead of waiting for symptoms"] },
    ],
    activities: [
      { id: "cy-1", number: "01", situation: "An email says your warehouse account will be disabled in ten minutes unless you use its password-reset link.", prompt: "What is the safest first response?", choices: [
        { id: "a", label: "Use the link quickly before the account is disabled", isSafe: false, feedback: "Urgency is a common social-engineering tactic. Do not use an unexpected reset link." },
        { id: "b", label: "Open the trusted sign-in page separately and report the message", isSafe: true, feedback: "Correct. Verify account status through a known route and report the suspicious message." },
        { id: "c", label: "Forward it to colleagues so they can test the link", isSafe: false, feedback: "Forwarding may expose more people. Use the approved reporting process instead." },
      ] },
      { id: "cy-2", number: "02", situation: "Your phone receives a multi-factor approval prompt while you are scanning stock, but you did not sign in anywhere.", prompt: "What should you do?", choices: [
        { id: "a", label: "Reject the prompt and report the unexpected sign-in attempt", isSafe: true, feedback: "Correct. An unsolicited approval can indicate that someone has your password." },
        { id: "b", label: "Approve it once to make the notification disappear", isSafe: false, feedback: "Approval could give another person access to your account." },
        { id: "c", label: "Ignore every future authentication prompt", isSafe: false, feedback: "Reject and report this event, then continue to review legitimate prompts carefully." },
      ] },
      { id: "cy-3", number: "03", situation: "You find an unlabelled USB drive beside a shared warehouse workstation.", prompt: "How should you handle it?", choices: [
        { id: "a", label: "Connect it briefly to identify its owner", isSafe: false, feedback: "Unknown removable media can contain malicious software and must not be connected." },
        { id: "b", label: "Leave it disconnected and follow the local reporting process", isSafe: true, feedback: "Correct. Keep it disconnected and let the responsible team handle it safely." },
        { id: "c", label: "Take it home and check it on a personal device", isSafe: false, feedback: "That transfers the risk and may expose workplace data or your personal device." },
      ] },
      { id: "cy-4", number: "04", situation: "A colleague says their scanner is locked and asks to use your username and password to finish an urgent pick.", prompt: "What is the safer decision?", choices: [
        { id: "a", label: "Share the login only until the pick is complete", isSafe: false, feedback: "Credentials must remain personal, even when the operational request feels urgent." },
        { id: "b", label: "Keep your credentials private and use the approved support route", isSafe: true, feedback: "Correct. Protect accountability and resolve the access problem through the authorised process." },
        { id: "c", label: "Write the password down so it can be returned later", isSafe: false, feedback: "Writing or sharing a password creates an uncontrolled copy of your credentials." },
      ] },
      { id: "cy-5", number: "05", situation: "You opened an unexpected attachment and the workstation immediately behaved differently.", prompt: "What should you do next?", choices: [
        { id: "a", label: "Report it immediately and follow the incident instructions", isSafe: true, feedback: "Correct. Prompt, honest reporting helps the responsible team contain the issue." },
        { id: "b", label: "Delete the email and wait to see whether anything happens", isSafe: false, feedback: "Waiting can increase the impact, and deleting the message may remove useful evidence." },
        { id: "c", label: "Continue working so the task is not delayed", isSafe: false, feedback: "Continuing may expose more systems or data. Stop and report the incident now." },
      ] },
    ],
  },
];

export const HAZARDS: HazardDefinition[] = [
  { id: "liquid-spill", code: "H1", title: "Liquid spill", risk: "Slip and fall", consequence: "A pedestrian could lose footing and sustain a sprain, fracture or impact injury.", correctiveAction: "Isolate the area, use the correct spill response and report the source before reopening the walkway.", position: "-3 -0.5 -4", colour: "#dc2626" },
  { id: "blocked-exit", code: "H2", title: "Obstructed emergency exit", risk: "Delayed evacuation", consequence: "People may be unable to leave quickly during an emergency.", correctiveAction: "Remove the obstruction immediately and keep the signed escape route clear at all times.", position: "4 0 -4", colour: "#d97706" },
  { id: "unsafe-lift", code: "H3", title: "Unsafe manual handling", risk: "Manual-handling injury", consequence: "Poor posture and an uncontrolled load can cause strain or crush injuries.", correctiveAction: "Stop, assess the load and use a handling aid or planned team lift where required.", position: "-4 0 1", colour: "#d97706" },
  { id: "vehicle-conflict", code: "H4", title: "Forklift / pedestrian conflict", risk: "Collision", consequence: "A pedestrian could be struck or trapped by a moving vehicle.", correctiveAction: "Restore segregation, use controlled crossings and confirm the driver has acknowledged the pedestrian.", position: "0 -0.4 4", colour: "#dc2626" },
  { id: "unsafe-stacking", code: "H5", title: "Unsafe stacking", risk: "Falling objects", consequence: "An unstable stack may collapse onto people, vehicles or equipment.", correctiveAction: "Stop access below, restack within rated limits and secure damaged or unstable loads.", position: "4 1 2", colour: "#d97706" },
  { id: "unsafe-height", code: "H6", title: "Unsafe working at height", risk: "Fall", consequence: "Unsuitable access equipment or overreach can result in a serious fall.", correctiveAction: "Use inspected, task-appropriate access equipment on stable ground and secure the work area.", position: "-2 2.5 3", colour: "#dc2626" },
  { id: "missing-ppe", code: "H7", title: "Missing PPE", risk: "Increased workplace exposure", consequence: "The worker has less protection from the identified residual hazards.", correctiveAction: "Pause the task and wear the PPE required by the site assessment and local controls.", position: "3 0 -2", colour: "#d97706" },
];

export const PLANNED_MODULES = [
  { title: "5 Whys / Root Cause Analysis", category: "Continuous improvement" },
  { title: "Warehouse Safety Challenge", category: "Scenario practice" },
] as const;

export function getTrainingModule(slug: string) {
  return CORE_MODULES.find((module) => module.slug === slug);
}
