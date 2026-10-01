import type { Metadata } from "next";
import { Award, Medal, ShieldCheck, Trophy } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireTrainee } from "@/lib/auth";
import { getLeaderboard } from "@/lib/queries";

export const metadata: Metadata = { title: "Leaderboard" };
export default async function LeaderboardPage() {
  const viewer = await requireTrainee();
  const entries = await getLeaderboard();
  const current = entries.find((entry) => entry.userId === viewer.id);
  return <><header className="page-heading leaderboard-heading"><div><p className="section-kicker">Team learning</p><h1>Safety leaderboard</h1><p>A privacy-conscious view of training points and completed modules. Email addresses and employee numbers are never shown.</p></div>{current && <div className="current-rank"><Trophy /><span>Your position</span><strong>#{current.rank}</strong></div>}</header>{entries.length ? <section className="leaderboard-table" aria-label="Safety leaderboard"><div className="leaderboard-table-head"><span>Rank</span><span>Trainee</span><span>Achievement</span><span>Modules</span><span>Points</span></div>{entries.map((entry) => <div className={entry.userId === viewer.id ? "current" : ""} key={entry.userId}><span className={`rank rank-${entry.rank}`}>{entry.rank <= 3 ? <Medal /> : entry.rank}</span><span className="leader-name"><i>{entry.displayName.slice(0, 1).toUpperCase()}</i><strong>{entry.displayName}</strong>{entry.userId === viewer.id && <small>You</small>}</span><span>{entry.achievement ? <><Award size={16} /> {entry.achievement}</> : "—"}</span><span>{entry.completedModules}</span><span><strong>{entry.points.toLocaleString("en-GB")}</strong></span></div>)}</section> : <EmptyState title="Leaderboard is waiting" description="No eligible persisted training totals are available yet. Complete a module to establish a position." />}<div className="privacy-banner"><ShieldCheck /><div><strong>Designed for recognition, not exposure</strong><p>Only display names and training totals are returned by the secure leaderboard function.</p></div></div></>;
}
