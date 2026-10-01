"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, RotateCcw, X } from "lucide-react";
import { AutoDismissNotice } from "@/components/ui/AutoDismissNotice";
import { CheckpointLink, saveTrainingCheckpoint } from "@/components/training/TrainingProgressTracker";
import type { PublicActivityScenario } from "@/types";

interface ActivityRunnerProps {
  moduleId: string;
  moduleSlug: string;
  moduleTitle: string;
  scenarios: PublicActivityScenario[];
}

interface DecisionResult {
  correct: boolean;
  choiceId: string;
  feedback: string;
}

export function ActivityRunner({ moduleId, moduleSlug, moduleTitle, scenarios }: ActivityRunnerProps) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, DecisionResult>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showSavedNotice, setShowSavedNotice] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scenario = scenarios[index];
  const persistedAnswer = scenario ? answers[scenario.id] : undefined;
  const selectedChoice = scenario?.choices.find((choice) => choice.id === (selected ?? persistedAnswer?.choiceId));
  const complete = index >= scenarios.length;
  const safeDecisions = Object.values(answers).filter((answer) => answer.correct).length;
  const score = useMemo(() => scenarios.length ? Math.round((safeDecisions / scenarios.length) * 100) : 0, [safeDecisions, scenarios.length]);

  useEffect(() => {
    let active = true;
    void fetch(`/api/activity/complete?moduleSlug=${encodeURIComponent(moduleSlug)}`)
      .then(async (response) => {
        if (!response.ok) return;
        const body = await response.json() as { events?: Array<{ eventKey?: string; selectedChoiceId?: string; correct?: boolean; feedback?: string }> };
        if (!active) return;
        const persisted: Record<string, DecisionResult> = {};
        (body.events ?? []).forEach((event) => {
          const savedScenario = scenarios.find((item) => item.id === event.eventKey);
          const savedChoice = savedScenario?.choices.find((item) => item.id === event.selectedChoiceId);
          if (savedScenario && savedChoice) persisted[savedScenario.id] = {
            correct: event.correct === true,
            choiceId: savedChoice.id,
            feedback: event.feedback ?? "Review this decision against the module guidance.",
          };
        });
        setAnswers(persisted);
        const firstIncomplete = scenarios.findIndex((item) => !persisted[item.id]);
        if (firstIncomplete === -1 && scenarios.length) {
          setIndex(scenarios.length);
          setSaved(true);
          setShowSavedNotice(true);
        } else if (firstIncomplete >= 0) {
          setIndex(firstIncomplete);
        }
        const restoredPosition = scenarios.length
          ? Math.round((Object.keys(persisted).length / scenarios.length) * 100)
          : 0;
        void saveTrainingCheckpoint(moduleId, "activity", restoredPosition).catch(() => undefined);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [moduleId, moduleSlug, scenarios]);

  async function checkDecision() {
    if (!selectedChoice || !scenario) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/activity/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId, moduleSlug, scenarioId: scenario.id, selectedChoiceId: selectedChoice.id }),
      });
      const body = await response.json() as { error?: string; correct?: boolean; feedback?: string; selectedChoiceId?: string };
      if (!response.ok) throw new Error(body.error || "Progress could not be saved.");
      setAnswers((current) => ({
        ...current,
        [scenario.id]: {
          correct: body.correct === true,
          choiceId: body.selectedChoiceId ?? selectedChoice.id,
          feedback: body.feedback || "Review this decision against the module guidance.",
        },
      }));
      const savedCount = Object.keys(answers).length + (answers[scenario.id] ? 0 : 1);
      void saveTrainingCheckpoint(moduleId, "activity", Math.round((savedCount / scenarios.length) * 100)).catch(() => undefined);
      setSelected(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Progress could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  function next() {
    if (!persistedAnswer) return;
    setSelected(null);
    if (index < scenarios.length - 1) setIndex(index + 1);
    else {
      setIndex(scenarios.length);
      setSaved(true);
      setShowSavedNotice(true);
    }
  }

  function restart() {
    setIndex(0); setSelected(null); setError(null); setShowSavedNotice(false);
  }

  if (complete) {
    return (
      <section className="completion-panel" aria-live="polite">
        <span className="completion-icon"><CheckCircle2 size={32} /></span>
        <p className="eyebrow"><span /> Activity complete</p>
        <h1>{safeDecisions} of {scenarios.length} safer decisions</h1>
        <p>You scored {score}% in the scenario activity. Review any missed decisions, then continue to the knowledge check.</p>
        {saving && <div className="inline-saving" role="status">Saving your progress…</div>}
        {showSavedNotice && <AutoDismissNotice className="form-status success" onDismiss={() => setShowSavedNotice(false)}><CheckCircle2 size={18} /> Progress saved securely</AutoDismissNotice>}
        {error && <AutoDismissNotice key={error} className="form-status error" role="alert" onDismiss={() => setError(null)}>{error}</AutoDismissNotice>}
        <div className="completion-actions">
          <button className="button button-secondary" onClick={restart}><RotateCcw size={17} /> Review activity</button>
          {saved ? <CheckpointLink className="button button-primary" moduleId={moduleId} stage="quiz" position={100} href={`/training/${moduleSlug}/quiz`}>Start knowledge check <ArrowRight size={18} /></CheckpointLink>
            : <span className="button button-primary button-disabled" aria-disabled="true">Start knowledge check <ArrowRight size={18} /></span>}
        </div>
      </section>
    );
  }

  return (
    <div className="activity-runner">
      <header className="runner-header">
        <Link href={`/training/${moduleSlug}`}><ArrowLeft size={18} /> Back to module</Link>
        <div><span>{moduleTitle}</span><strong>Decision {index + 1} of {scenarios.length}</strong></div>
      </header>
      <div className="runner-progress"><span style={{ width: `${((index + 1) / scenarios.length) * 100}%` }} /></div>
      <section className="scenario-stage">
        <div className="scenario-number">Scenario / {scenario.number}</div>
        <p className="scenario-situation">{scenario.situation}</p>
        <h1>{scenario.prompt}</h1>
        <div className="choice-list" role="radiogroup" aria-label={scenario.prompt}>
          {scenario.choices.map((choice, choiceIndex) => {
            const isSelected = selectedChoice?.id === choice.id;
            const revealed = Boolean(persistedAnswer);
            return (
              <button key={choice.id} role="radio" aria-checked={isSelected} className={`choice ${isSelected ? "selected" : ""} ${revealed && isSelected ? (persistedAnswer?.correct ? "correct" : "incorrect") : ""}`} onClick={() => !revealed && setSelected(choice.id)} disabled={revealed}>
                <span>{String.fromCharCode(65 + choiceIndex)}</span><strong>{choice.label}</strong>{revealed && isSelected && (persistedAnswer?.correct ? <Check /> : <X />)}
              </button>
            );
          })}
        </div>
        {persistedAnswer && (
          <div className={`decision-feedback ${persistedAnswer.correct ? "safe" : "unsafe"}`} role="status">
            <strong>{persistedAnswer.correct ? "Safer decision" : "Review this choice"}</strong><p>{persistedAnswer.feedback}</p>
          </div>
        )}
        <div className="runner-actions">
          {!persistedAnswer ? <button className="button button-primary" onClick={checkDecision} disabled={!selectedChoice || saving}>{saving ? "Checking decision…" : "Check decision"}<ArrowRight size={18} /></button>
            : <button className="button button-primary" onClick={next}>{index === scenarios.length - 1 ? "Complete activity" : "Next scenario"}<ArrowRight size={18} /></button>}
        </div>
      </section>
    </div>
  );
}
