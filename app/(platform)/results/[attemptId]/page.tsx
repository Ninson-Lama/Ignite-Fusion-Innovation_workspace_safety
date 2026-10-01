import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Award, CheckCircle2, CircleAlert, Gauge } from "lucide-react";
import { requireTrainee } from "@/lib/auth";
import { getAttempt } from "@/lib/queries";

export const metadata: Metadata = { title: "Assessment result" };
export default async function ResultPage({ params }: { params: Promise<{ attemptId: string }> }) {
  const viewer = await requireTrainee();
  const attempt = await getAttempt(viewer.id, (await params).attemptId);
  if (!attempt) notFound();
  const passed = attempt.passed;
  const totalPoints = (attempt.activity_score ?? 0) + (attempt.points_earned ?? 0);
  return <article className="result-page"><header className={`result-hero ${passed ? "passed" : "review"}`}><span>{passed ? <CheckCircle2 /> : <CircleAlert />}</span><p className="eyebrow"><i /> Assessment result</p><h1>{passed ? "Pass threshold achieved" : "Review recommended"}</h1><p>{attempt.module.title || "Training module"}</p><div className="result-score"><strong>{attempt.percentage}</strong><span>%</span></div><small>{attempt.passMark === null ? "Configured module threshold" : `Module threshold: ${attempt.passMark}%`} · This is not a formal accreditation.</small></header><section className="result-breakdown"><div><Gauge /><span>Knowledge check</span><strong>{attempt.score} / {attempt.max_score}</strong></div><div><Award /><span>Activity score</span><strong>{attempt.activity_score ?? 0}</strong></div><div><Award /><span>Total points</span><strong>{totalPoints}</strong></div><div>{passed ? <CheckCircle2 /> : <CircleAlert />}<span>Outcome</span><strong>{passed ? "Passed" : "Review"}</strong></div></section><section className="result-achievement"><p className="section-kicker">Achievement</p><h2>{attempt.achievements.length ? attempt.achievements.join(" · ") : "No new achievement on this attempt"}</h2><p>All earned achievements remain available from your achievements page.</p></section><section className="result-next"><div><p className="section-kicker">Next action</p><h2>{passed ? "Keep the momentum going" : "Revisit the key controls"}</h2><p>{passed ? "Your progress has been updated. Continue with the next available module." : "Review the learning and activity feedback before another attempt."}</p></div><div><Link className="button button-secondary" href="/dashboard">Dashboard</Link><Link className="button button-secondary" href="/progress">Progress</Link><Link className="button button-secondary" href={`/training/${attempt.module.slug || ""}`}>Review module</Link><Link className="button button-primary" href={passed ? "/training" : `/training/${attempt.module.slug || ""}/quiz`}>{passed ? "Next training" : "Retry knowledge check"}<ArrowRight size={18} /></Link></div></section></article>;
}
