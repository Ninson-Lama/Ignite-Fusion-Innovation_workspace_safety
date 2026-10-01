"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type DragEvent } from "react";
import {
  ArrowLeft, ArrowRight, Boxes, Check, CheckCircle2, ClipboardCheck,
  Forklift, Grip, HardHat, LoaderCircle, Package, RotateCcw, UserRound, X,
} from "lucide-react";
import { AutoDismissNotice } from "@/components/ui/AutoDismissNotice";
import { CheckpointLink, saveTrainingCheckpoint } from "@/components/training/TrainingProgressTracker";
import { getMiniGameTemplate, type MiniGameActivityKind } from "@/lib/mini-games";
import type { PublicActivityScenario } from "@/types";

interface MiniGameRunnerProps {
  moduleId: string;
  moduleSlug: string;
  moduleTitle: string;
  activityKind: MiniGameActivityKind;
  scenarios: PublicActivityScenario[];
}

interface GameRoundResult { correct: boolean; choiceId: string; feedback: string }

function checkpointName(scenario: PublicActivityScenario, index: number) {
  const names: Record<string, string> = {
    "game-forklift-01": "Tyres", "game-forklift-02": "Forks",
    "game-forklift-03": "Hydraulics", "game-forklift-04": "Lights & warnings",
  };
  return names[scenario.id] ?? `Checkpoint ${index + 1}`;
}

export function MiniGameRunner({ moduleId, moduleSlug, moduleTitle, activityKind, scenarios }: MiniGameRunnerProps) {
  const template = getMiniGameTemplate(activityKind);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, GameRoundResult>>({});
  const [restoring, setRestoring] = useState(true);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [inspected, setInspected] = useState<string | null>(null);
  const [forkliftPosition, setForkliftPosition] = useState({ x: 50, y: 50 });
  const [forkliftDirection, setForkliftDirection] = useState("forward");
  const [forkliftForkHeight, setForkliftForkHeight] = useState("lowered");
  const [forkliftBrake, setForkliftBrake] = useState(true);
  const [forkliftHorn, setForkliftHorn] = useState(false);
  const [showRestoredNotice, setShowRestoredNotice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);
  const scenario = scenarios[index];
  const persistedAnswer = scenario ? answers[scenario.id] : undefined;
  const selectedChoice = scenario?.choices.find((choice) => choice.id === (persistedAnswer?.choiceId ?? selected));
  const complete = scenarios.length > 0 && index >= scenarios.length;
  const safeMoves = Object.values(answers).filter((answer) => answer.correct).length;
  const canChoose = !restoring && !restoreError && !saving && !persistedAnswer
    && (activityKind !== "forklift_precheck" || inspected === scenario?.id);
  const dragSourceToTarget = activityKind === "sorting_zone" || activityKind === "load_stacking";

  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/activity/complete?moduleSlug=${encodeURIComponent(moduleSlug)}`, {
      cache: "no-store", signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) throw new Error("Your saved game could not be loaded. Please try again.");
      const body = await response.json() as { events?: Array<{ eventKey?: string; selectedChoiceId?: string; correct?: boolean; feedback?: string }> };
      if (controller.signal.aborted) return;
      if (!Array.isArray(body.events)) throw new Error("Your saved game could not be loaded. Please try again.");
      const persisted: Record<string, GameRoundResult> = {};
      body.events.forEach((event) => {
        const savedScenario = scenarios.find((item) => item.id === event.eventKey);
        const savedChoice = savedScenario?.choices.find((item) => item.id === event.selectedChoiceId);
        if (savedScenario && savedChoice) persisted[savedScenario.id] = {
          correct: event.correct === true, choiceId: savedChoice.id,
          feedback: event.feedback ?? "Review this move against the module guidance.",
        };
      });
      setAnswers(persisted);
      const firstIncomplete = scenarios.findIndex((item) => !persisted[item.id]);
      setIndex(firstIncomplete === -1 ? scenarios.length : firstIncomplete);
      setSelected(null);
      setInspected(null);
      setRestoreError(null);
      setShowRestoredNotice(Object.keys(persisted).length > 0);
    }).catch((requestError) => {
      if (!controller.signal.aborted) setRestoreError(requestError instanceof Error ? requestError.message : "Your saved game could not be loaded.");
    }).finally(() => {
      if (!controller.signal.aborted) setRestoring(false);
    });
    return () => controller.abort();
  }, [moduleSlug, scenarios, restoreAttempt]);

  useEffect(() => {
    if (activityKind !== "forklift_precheck") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (!["arrowup", "arrowdown", "arrowleft", "arrowright", "b", "f", "h"].includes(key)) return;
      event.preventDefault();
      if (key === "b") return setForkliftBrake((current) => !current);
      if (key === "f") return setForkliftForkHeight((current) => current === "lowered" ? "raised" : "lowered");
      if (key === "h") { setForkliftHorn(true); window.setTimeout(() => setForkliftHorn(false), 500); return; }
      if (forkliftBrake) return;
      setForkliftDirection(key === "arrowdown" ? "reverse" : "forward");
      setForkliftPosition((current) => ({
        x: Math.max(14, Math.min(86, current.x + (key === "arrowleft" ? -6 : key === "arrowright" ? 6 : 0))),
        y: Math.max(18, Math.min(82, current.y + (key === "arrowup" ? -6 : key === "arrowdown" ? 6 : 0))),
      }));
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activityKind, forkliftBrake]);

  useEffect(() => {
    if (persistedAnswer) actionRef.current?.focus();
  }, [persistedAnswer]);

  function selectChoice(choiceId: string) {
    if (!canChoose || !scenario?.choices.some((choice) => choice.id === choiceId)) return;
    setSelected(choiceId);
    setError(null);
  }

  function startDragging(event: DragEvent<HTMLElement>, value: string) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("application/x-safety360-game", value);
  }

  async function checkMove() {
    if (!scenario || !selectedChoice || !canChoose || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/activity/complete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId, moduleSlug, scenarioId: scenario.id, selectedChoiceId: selectedChoice.id }),
      });
      const body = await response.json() as { error?: string; correct?: boolean; feedback?: string; selectedChoiceId?: string };
      if (!response.ok) throw new Error(body.error || "This game move could not be saved. Try again.");
      const confirmedChoice = scenario.choices.find((choice) => choice.id === body.selectedChoiceId);
      if (typeof body.correct !== "boolean" || !confirmedChoice) {
        throw new Error("The saved move could not be confirmed. Try again.");
      }
      setAnswers((current) => ({ ...current, [scenario.id]: {
        correct: body.correct === true, choiceId: confirmedChoice.id,
        feedback: body.feedback || "Review this move against the module guidance.",
      } }));
      const savedCount = Object.keys(answers).length + (answers[scenario.id] ? 0 : 1);
      void saveTrainingCheckpoint(moduleId, "activity", Math.round(savedCount / scenarios.length * 100)).catch(() => undefined);
      setSelected(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "This game move could not be saved.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function nextRound() {
    if (!persistedAnswer) return;
    setSelected(null);
    setInspected(null);
    setError(null);
    setIndex((current) => Math.min(current + 1, scenarios.length));
    requestAnimationFrame(() => headingRef.current?.focus());
  }

  if (restoring) return <section className="quiz-restore" role="status"><LoaderCircle className="spin" size={24} /><div><strong>Restoring your challenge</strong><p>Loading your last saved move…</p></div></section>;
  if (restoreError) return <section className="mini-game-recovery"><h1>Let’s recover your progress</h1><p role="alert">{restoreError}</p><div><Link className="button button-secondary" href={`/training/${moduleSlug}`}><ArrowLeft size={17} /> Back to module</Link><button type="button" className="button button-primary" onClick={() => { setRestoring(true); setRestoreAttempt((value) => value + 1); }}><RotateCcw size={17} /> Try again</button></div></section>;

  if (complete) return <section className="completion-panel mini-game-complete" aria-live="polite">
    <span className="completion-icon"><CheckCircle2 size={32} /></span>
    <p className="eyebrow"><span /> Challenge complete</p>
    <h1 tabIndex={-1} ref={headingRef}>{safeMoves} of {scenarios.length} safer moves</h1>
    <p>You scored {Math.round(safeMoves / scenarios.length * 100)}% in {template?.name ?? "the activity"}. Your moves are saved. Review the feedback or continue to the knowledge check.</p>
    <div className="completion-actions"><button type="button" className="button button-secondary" onClick={() => { setIndex(0); setSelected(null); setError(null); setShowRestoredNotice(false); }}><RotateCcw size={17} /> Review game</button><CheckpointLink className="button button-primary" moduleId={moduleId} stage="quiz" position={100} href={`/training/${moduleSlug}/quiz`}>Start knowledge check <ArrowRight size={18} /></CheckpointLink></div>
  </section>;
  if (!scenario) return null;

  const instructions = activityKind === "forklift_precheck" ? "Open the highlighted checkpoint, inspect the condition, then record your decision."
    : activityKind === "ppe_dress_up" ? "Drag a PPE kit onto the trainee, or tap a kit to equip it."
      : activityKind === "sorting_zone" ? "Drag the control card into a destination bin, or tap a bin."
        : "Drag the load onto a placement zone, or tap a zone. This is a guided rack-safety challenge.";

  return <div className={`activity-runner mini-game-runner game-${activityKind}`}>
    <header className="runner-header"><Link href={`/training/${moduleSlug}`}><ArrowLeft size={18} /> Back to module</Link><div><span>{moduleTitle}</span><strong>Round {index + 1} of {scenarios.length}</strong></div></header>
    <div className="runner-progress" role="progressbar" aria-label="Game rounds saved" aria-valuenow={Object.keys(answers).length} aria-valuemin={0} aria-valuemax={scenarios.length}><span style={{ width: `${Object.keys(answers).length / scenarios.length * 100}%` }} /></div>
    <section className="mini-game-stage">
      <div className="mini-game-prompt"><p className="mini-game-kicker">{template?.name}</p><h1 tabIndex={-1} ref={headingRef}>{scenario.prompt}</h1><p>{instructions}</p></div>
      <div className="mini-game-arena">
        <div className="mini-game-playfield">
          {activityKind === "forklift_precheck" ? <>
            <div className="forklift-simulator" aria-label="Forklift route practice">
              <div className="forklift-route"><span className="route-crossing">PEDESTRIAN CROSSING</span><span className="route-blind-corner">BLIND CORNER · HORN</span><span className="forklift-avatar" style={{ left: `${forkliftPosition.x}%`, top: `${forkliftPosition.y}%` }}><Forklift size={28} aria-hidden="true" /></span></div>
              <div className="forklift-controls"><strong>Route practice</strong><span>{forkliftDirection} · forks {forkliftForkHeight} · brakes {forkliftBrake ? "on" : "off"}{forkliftHorn && " · horn"}</span><div><button type="button" onClick={() => setForkliftBrake((current) => !current)} aria-pressed={forkliftBrake}>Brake {forkliftBrake ? "on" : "off"}</button><button type="button" onClick={() => setForkliftForkHeight((current) => current === "lowered" ? "raised" : "lowered")} aria-pressed={forkliftForkHeight === "raised"}>Forks {forkliftForkHeight}</button><button type="button" onClick={() => { setForkliftHorn(true); window.setTimeout(() => setForkliftHorn(false), 500); }}>Sound horn</button></div><small>Arrow keys move · B brake · F forks · H horn</small></div>
            </div>
            <div className="mini-game-source-icon"><Forklift size={42} aria-hidden="true" /><strong>Pre-shift inspection</strong></div>
            <div className="inspection-points" aria-label="Inspection checkpoints">{scenarios.map((item, itemIndex) => <button
              type="button" key={item.id} disabled={itemIndex !== index || saving}
              aria-pressed={item.id === inspected || Boolean(answers[item.id])}
              className={itemIndex === index ? "active" : ""}
              onClick={() => setInspected(item.id)}
            ><span>{answers[item.id] ? answers[item.id].correct ? <Check size={15} /> : <X size={15} /> : itemIndex + 1}</span>{checkpointName(item, itemIndex)}{itemIndex === index && <ArrowRight size={15} />}</button>)}</div>
          </> : activityKind === "ppe_dress_up" ? <div className={`ppe-equip-zone${selectedChoice ? " equipped" : ""}`} onDragOver={(event) => { if (canChoose) event.preventDefault(); }} onDrop={(event) => { event.preventDefault(); selectChoice(event.dataTransfer.getData("application/x-safety360-game")); }}>
            <UserRound size={76} aria-hidden="true" /><strong>{selectedChoice ? "Selected PPE kit" : "Equip the trainee"}</strong>
            <span>{selectedChoice?.label ?? "Drop your kit here, or tap a kit beside the trainee."}</span>
            {selectedChoice && <HardHat size={28} aria-hidden="true" />}
          </div> : <div className={`mini-game-source-card${selectedChoice ? " placed" : ""}`} draggable={canChoose}
            onDragStart={(event) => startDragging(event, scenario.id)}>
            {activityKind === "sorting_zone" ? <ClipboardCheck size={44} aria-hidden="true" /> : <Package size={44} aria-hidden="true" />}
            <strong>{activityKind === "sorting_zone" ? "Control card" : "Incoming load"} {scenario.number}</strong>
            <p>{scenario.situation}</p><small><Grip size={15} /> Drag to a {activityKind === "sorting_zone" ? "bin" : "zone"}, or tap one</small>
          </div>}
        </div>
        <div className="mini-game-decisions">
          {!dragSourceToTarget && <p className="mini-game-condition">{activityKind !== "forklift_precheck" || inspected === scenario.id || persistedAnswer ? scenario.situation : "Select the highlighted checkpoint to reveal the inspection condition."}</p>}
          <div className={`mini-game-choices${dragSourceToTarget ? " game-destinations" : ""}`} role="group" aria-label={activityKind === "sorting_zone" ? "Destination bins" : activityKind === "load_stacking" ? "Load placement zones" : "Available moves"}>
            {scenario.choices.map((choice, choiceIndex) => {
              const isSelected = selectedChoice?.id === choice.id;
              return <button type="button" key={choice.id}
                className={`mini-game-choice${isSelected ? " selected" : ""}${persistedAnswer && isSelected ? persistedAnswer.correct ? " correct" : " incorrect" : ""}`}
                aria-pressed={isSelected} disabled={!canChoose} draggable={activityKind === "ppe_dress_up" && canChoose}
                onClick={() => selectChoice(choice.id)} onDragStart={(event) => startDragging(event, choice.id)}
                onDragOver={(event) => { if (canChoose && dragSourceToTarget) event.preventDefault(); }}
                onDrop={(event) => { event.preventDefault(); if (dragSourceToTarget && event.dataTransfer.getData("application/x-safety360-game") === scenario.id) selectChoice(choice.id); }}
              ><span>{activityKind === "load_stacking" ? <Boxes size={21} /> : String.fromCharCode(65 + choiceIndex)}</span><strong>{choice.label}</strong>{isSelected && (persistedAnswer ? persistedAnswer.correct ? <Check size={18} /> : <X size={18} /> : dragSourceToTarget ? <Package size={20} /> : <Check size={18} />)}</button>;
            })}
          </div>
          {activityKind === "load_stacking" && selectedChoice && <p className="mini-game-placement" role="status"><Package size={17} /> {persistedAnswer?.correct === false ? "Placement rejected — review the loading rule below." : `Load selected for: ${selectedChoice.label}`}</p>}
        </div>
      </div>
      <footer className="mini-game-footer">
        <div className="mini-game-feedback">
          {persistedAnswer ? <div className={`decision-feedback ${persistedAnswer.correct ? "safe" : "unsafe"}`} role="status"><strong>{persistedAnswer.correct ? "Safer move" : "Review this move"}</strong><p>{persistedAnswer.feedback}</p></div>
            : error ? <div className="form-status error" role="alert">{error}</div>
              : <p>{selectedChoice ? "Check your move to save it and see feedback." : "Choose your move to continue."}</p>}
          {showRestoredNotice && <AutoDismissNotice className="form-status success" onDismiss={() => setShowRestoredNotice(false)}><CheckCircle2 size={16} /> Continued from your saved game</AutoDismissNotice>}
        </div>
        {!persistedAnswer ? <button type="button" className="button button-primary" onClick={() => void checkMove()} disabled={!selectedChoice || !canChoose}>{saving ? <><LoaderCircle className="spin" size={18} /> Saving move…</> : <>Check move <ArrowRight size={18} /></>}</button>
          : <button type="button" className="button button-primary" ref={actionRef} onClick={nextRound}>{index === scenarios.length - 1 ? "Finish challenge" : "Next round"}<ArrowRight size={18} /></button>}
      </footer>
    </section>
  </div>;
}
