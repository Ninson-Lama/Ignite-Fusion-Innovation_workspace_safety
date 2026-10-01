"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, CircleAlert, LoaderCircle } from "lucide-react";
import { AutoDismissNotice } from "@/components/ui/AutoDismissNotice";
import { saveTrainingCheckpoint } from "@/components/training/TrainingProgressTracker";
import type { QuizQuestion } from "@/types";

interface CheckResponse { correct: boolean; explanation?: string; correctAnswer?: string; error?: string; }
interface SubmitResponse { attemptId?: string; percentage?: number; passed?: boolean; error?: string; }
interface ResumeAnswer { questionId: string; selectedAnswer: string[]; correct: boolean; explanation?: string; }

export function QuizRunner({ moduleId, moduleSlug, moduleTitle, passMark, questions }: { moduleId: string; moduleSlug: string; moduleTitle: string; passMark: number; questions: QuizQuestion[] }) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [feedback, setFeedback] = useState<CheckResponse | null>(null);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResponse | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [showRestoredNotice, setShowRestoredNotice] = useState(false);
  const question = questions[index];

  useEffect(() => {
    let active = true;
    void fetch(`/api/quiz/answer?moduleId=${encodeURIComponent(moduleId)}`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as { answers?: ResumeAnswer[]; error?: string };
        if (!response.ok) throw new Error(body.error || "Saved assessment progress could not be loaded.");
        if (!active) return;
        const savedAnswers = (body.answers ?? []).filter((answer) => (
          questions.some((candidate) => candidate.id === answer.questionId)
          && Array.isArray(answer.selectedAnswer)
        ));
        const answerMap = Object.fromEntries(savedAnswers.map((answer) => [answer.questionId, answer.selectedAnswer]));
        setAnswers(answerMap);
        const firstIncomplete = questions.findIndex((candidate) => !answerMap[candidate.id]);
        if (firstIncomplete === -1 && questions.length && savedAnswers.length) {
          const lastIndex = questions.length - 1;
          const lastQuestion = questions[lastIndex];
          const lastAnswer = savedAnswers.find((answer) => answer.questionId === lastQuestion.id);
          setIndex(lastIndex);
          setSelected(answerMap[lastQuestion.id] ?? []);
          setFeedback(lastAnswer ? { correct: lastAnswer.correct, explanation: lastAnswer.explanation } : null);
        } else if (firstIncomplete >= 0) {
          setIndex(firstIncomplete);
          setSelected([]);
          setFeedback(null);
        }
        if (savedAnswers.length) setShowRestoredNotice(true);
        void saveTrainingCheckpoint(moduleId, "quiz", Math.round((savedAnswers.length / Math.max(questions.length, 1)) * 100)).catch(() => undefined);
      })
      .catch((requestError) => {
        if (active) setError(requestError instanceof Error ? requestError.message : "Saved assessment progress could not be loaded.");
      })
      .finally(() => {
        if (active) setRestoring(false);
      });
    return () => { active = false; };
  }, [moduleId, questions]);

  async function checkAnswer() {
    if (!question || selected.length === 0) return;
    setChecking(true); setError(null);
    try {
      const response = await fetch("/api/quiz/answer", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: question.id, selectedAnswer: selected }),
      });
      const body = await response.json() as CheckResponse;
      if (!response.ok) throw new Error(body.error || "Your answer could not be checked.");
      setAnswers((current) => ({ ...current, [question.id]: [...selected] }));
      setFeedback(body);
      void saveTrainingCheckpoint(moduleId, "quiz", Math.round(((Object.keys(answers).length + 1) / questions.length) * 100)).catch(() => undefined);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Your answer could not be checked.");
    } finally { setChecking(false); }
  }

  async function advance() {
    if (index < questions.length - 1) {
      setIndex(index + 1); setSelected([]); setFeedback(null); setError(null); return;
    }
    setSubmitting(true); setError(null);
    try {
      const response = await fetch("/api/quiz/submit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId, answers }),
      });
      const body = await response.json() as SubmitResponse;
      if (!response.ok) throw new Error(body.error || "Your assessment could not be submitted.");
      void saveTrainingCheckpoint(moduleId, "quiz", body.passed ? 100 : 0).catch(() => undefined);
      setResult(body);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Your assessment could not be submitted.");
    } finally { setSubmitting(false); }
  }

  if (restoring) {
    return <section className="quiz-restore" role="status"><LoaderCircle className="spin" size={24} /><div><strong>Restoring your assessment</strong><p>Loading your last securely saved answer…</p></div></section>;
  }

  if (result) {
    const passed = Boolean(result.passed);
    return (
      <section className="completion-panel quiz-complete" aria-live="polite">
        <span className={`completion-icon ${passed ? "success" : "review"}`}>{passed ? <CheckCircle2 size={32} /> : <CircleAlert size={32} />}</span>
        <p className="eyebrow"><span /> Knowledge check submitted</p>
        <h1>{result.percentage ?? 0}%</h1>
        <p>{passed ? "Pass threshold achieved. Your result and module progress have been recorded." : `The ${passMark}% pass threshold was not reached. Review the module before trying again.`}</p>
        <div className="completion-actions">
          <Link className="button button-secondary" href={`/training/${moduleSlug}`}>Review module</Link>
          {result.attemptId && <Link className="button button-primary" href={`/results/${result.attemptId}`}>View full result <ArrowRight size={18} /></Link>}
        </div>
      </section>
    );
  }

  if (!question) return null;

  const allowsMultiple = question.questionType === "multiple_choice";
  const questionInstruction = allowsMultiple
    ? "Select every option that applies, then check your answer."
    : question.questionType === "true_false"
      ? "Choose True or False, then check your answer."
      : "Choose the safest response, then check your answer.";

  function selectOption(optionId: string) {
    if (feedback) return;
    setSelected((current) => {
      if (!allowsMultiple) return [optionId];
      return current.includes(optionId)
        ? current.filter((id) => id !== optionId)
        : [...current, optionId];
    });
  }

  return (
    <div className="quiz-runner">
      <header className="runner-header">
        <Link href={`/training/${moduleSlug}`}><ArrowLeft size={18} /> Exit assessment</Link>
        <div><span>{moduleTitle}</span><strong>Question {index + 1} of {questions.length}</strong></div>
      </header>
      <div className="runner-progress"><span style={{ width: `${((index + 1) / questions.length) * 100}%` }} /></div>
      <section className={`question-stage quiz-question-stage${feedback ? " has-feedback" : ""}`}>
        <div className="question-type">{question.questionType.replaceAll("_", " ")}</div>
        <h1>{question.prompt}</h1>
        <p className="question-instruction">{questionInstruction}</p>
        {showRestoredNotice && <AutoDismissNotice className="form-status success" onDismiss={() => setShowRestoredNotice(false)}><CheckCircle2 size={18} /> Continued from your last saved question</AutoDismissNotice>}
        <div className="choice-list" role={allowsMultiple ? "group" : "radiogroup"} aria-label={question.prompt}>
          {question.options.map((option, optionIndex) => (
            <button key={option.id} role={allowsMultiple ? "checkbox" : "radio"} aria-checked={selected.includes(option.id)} className={`choice ${selected.includes(option.id) ? "selected" : ""}`} onClick={() => selectOption(option.id)} disabled={Boolean(feedback)}>
              <span>{String.fromCharCode(65 + optionIndex)}</span><strong>{option.label}</strong>
            </button>
          ))}
        </div>
        {feedback && <div className={`decision-feedback ${feedback.correct ? "safe" : "unsafe"}`} role="status"><strong>{feedback.correct ? "Correct" : "Not quite"}</strong><p>{feedback.explanation || question.explanation}</p></div>}
        {error && <AutoDismissNotice key={error} className="form-status error" role="alert" onDismiss={() => setError(null)}>{error}</AutoDismissNotice>}
        <div className="runner-actions">
          {!feedback ? <button className="button button-primary" disabled={selected.length === 0 || checking} onClick={checkAnswer}>{checking ? <><LoaderCircle className="spin" size={18} /> Checking…</> : <>Check answer <ArrowRight size={18} /></>}</button>
            : <button className="button button-primary" disabled={submitting} onClick={advance}>{submitting ? <><LoaderCircle className="spin" size={18} /> Recording result…</> : <>{index === questions.length - 1 ? "Submit assessment" : "Next question"}<ArrowRight size={18} /></>}</button>}
        </div>
      </section>
    </div>
  );
}
