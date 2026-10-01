import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { requireAdmin } from "@/lib/auth";
import { getAdminData } from "@/lib/queries";

export const metadata: Metadata = { title: "Assessment results" };
export default async function AdminResultsPage() {
  await requireAdmin();
  const data = await getAdminData();
  const profileMap = new Map(data.profiles.map((profile) => [profile.id, profile]));
  const moduleMap = new Map(data.modules.map((module) => [module.id, module]));
  const traineeIds = new Set(data.profiles.filter((profile) => profile.role === "trainee").map((profile) => profile.id));
  const attempts = data.attempts.filter((attempt) => traineeIds.has(attempt.user_id));
  return <><header className="page-heading"><div><p className="section-kicker">Knowledge checks</p><h1>Assessment results</h1><p>Authorised review of persisted scores, outcomes and users who may need further learning.</p></div></header><section className="admin-table-card">{attempts.length ? <div className="responsive-table"><table><thead><tr><th>Trainee</th><th>Department</th><th>Module</th><th>Score</th><th>Outcome</th><th>Completed</th></tr></thead><tbody>{attempts.map((attempt) => <tr key={attempt.id}><td><strong>{profileMap.get(attempt.user_id)?.full_name || "Authorised trainee"}</strong></td><td>{profileMap.get(attempt.user_id)?.department || "—"}</td><td>{moduleMap.get(attempt.module_id)?.title || "Training module"}</td><td><strong>{attempt.percentage}%</strong></td><td><StatusBadge status={attempt.passed ? "passed" : "review"} /></td><td>{new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(attempt.completed_at))}</td></tr>)}</tbody></table></div> : <EmptyState title="No assessment results" description="Submitted trainee knowledge checks will appear here when authorised by row-level security." />}</section></>;
}
