import type { Metadata } from "next";
import { CircleAlert, ClipboardCheck, Gauge, TrendingUp } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireAdmin } from "@/lib/auth";
import { getAdminData, getReportsSummary } from "@/lib/queries";

export const metadata: Metadata = { title: "Training reports" };

export default async function AdminReportsPage() {
  await requireAdmin();
  const [data, summary] = await Promise.all([getAdminData(), getReportsSummary()]);
  const profileMap = new Map(data.profiles.map((profile) => [profile.id, profile]));
  const activeTraineeIds = new Set(data.profiles.filter((profile) => profile.role === "trainee" && profile.status === "active").map((profile) => profile.id));
  const activeAssignments = data.assignments.filter((assignment) => activeTraineeIds.has(assignment.user_id) && assignment.status !== "cancelled");
  const traineeAttempts = data.attempts.filter((attempt) => activeTraineeIds.has(attempt.user_id));
  const latestAttemptMap = new Map<string, (typeof data.attempts)[number]>();
  traineeAttempts.forEach((attempt) => {
    const key = `${attempt.user_id}:${attempt.module_id}`;
    if (!latestAttemptMap.has(key)) latestAttemptMap.set(key, attempt);
  });
  const latestAttempts = [...latestAttemptMap.values()];

  const reportRows = data.modules.map((module) => {
    const assignments = activeAssignments.filter((assignment) => assignment.module_id === module.id);
    const attempts = latestAttempts.filter((attempt) => attempt.module_id === module.id);
    const complete = assignments.filter((assignment) => assignment.status === "completed").length;
    const average = attempts.length
      ? Math.round(attempts.reduce((sum, item) => sum + item.percentage, 0) / attempts.length)
      : null;
    return {
      ...module,
      assigned: assignments.length,
      complete,
      rate: assignments.length ? Math.round((complete / assignments.length) * 100) : 0,
      average,
      reviews: attempts.filter((attempt) => !attempt.passed).length,
    };
  });

  const today = new Date().toISOString().slice(0, 10);
  const overdue = activeAssignments.filter((assignment) =>
    assignment.due_date && assignment.due_date < today && ["assigned", "in_progress"].includes(assignment.status),
  );
  const reviewUsers = [...new Set(latestAttempts.filter((attempt) => !attempt.passed).map((attempt) => attempt.user_id))];
  const completionCount = summary?.completedAssignments ?? activeAssignments.filter((item) => item.status === "completed").length;
  const fallbackAverage = latestAttempts.length
    ? Math.round(latestAttempts.reduce((sum, attempt) => sum + attempt.percentage, 0) / latestAttempts.length)
    : null;

  return <>
    <header className="page-heading"><div><p className="section-kicker">Operational insight</p><h1>Training reports</h1><p>Accessible completion, performance and attention indicators calculated from authorised database records.</p></div></header>
    <section className="report-summary-row">
      <article><ClipboardCheck /><span>Completions</span><strong>{completionCount}</strong></article>
      <article><TrendingUp /><span>Assignments</span><strong>{summary?.totalAssignments ?? activeAssignments.length}</strong></article>
      <article><Gauge /><span>Average latest score</span><strong>{summary ? summary.averageQuizPercentage === null ? "—" : `${Math.round(summary.averageQuizPercentage)}%` : fallbackAverage === null ? "—" : `${fallbackAverage}%`}</strong></article>
      <article className={(summary?.overdueAssignments ?? overdue.length) ? "attention" : ""}><CircleAlert /><span>Overdue</span><strong>{summary?.overdueAssignments ?? overdue.length}</strong></article>
    </section>

    {reportRows.length ? <section className="report-card detailed-report">
      <div className="section-heading"><div><p className="section-kicker">Module performance</p><h2>Completion and assessment</h2></div></div>
      <div className="report-chart" aria-hidden="true">{reportRows.map((row) => <div key={row.id}><span>{row.title}</span><i><b style={{ width: `${row.rate}%` }} /></i><strong>{row.rate}%</strong></div>)}</div>
      <div className="responsive-table"><table><caption>Text equivalent for module performance chart</caption><thead><tr><th>Module</th><th>Assigned</th><th>Complete</th><th>Completion rate</th><th>Average latest score</th><th>Users for review</th></tr></thead><tbody>{reportRows.map((row) => <tr key={row.id}><td><strong>{row.title}</strong></td><td>{row.assigned}</td><td>{row.complete}</td><td>{row.rate}%</td><td>{row.average === null ? "—" : `${row.average}%`}</td><td>{row.reviews}</td></tr>)}</tbody></table></div>
    </section> : <EmptyState title="No report data" description="Seed modules and record training activity to populate reporting." />}

    <div className="report-bottom-grid">
      <section className="report-card"><h2>Overdue assignments</h2>{overdue.length ? <ul className="attention-list">{overdue.map((assignment) => <li key={assignment.id}><CircleAlert /><div><strong>{profileMap.get(assignment.user_id)?.full_name || "Authorised trainee"}</strong><span>Due {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(assignment.due_date!))}</span></div></li>)}</ul> : <p className="positive-empty">No visible assignments are overdue.</p>}</section>
      <section className="report-card"><h2>Users requiring review</h2>{reviewUsers.length ? <ul className="attention-list">{reviewUsers.map((userId) => <li key={userId}><Gauge /><div><strong>{profileMap.get(userId)?.full_name || "Authorised trainee"}</strong><span>Latest module assessment did not meet its configured threshold</span></div></li>)}</ul> : <p className="positive-empty">No visible users currently require assessment review.</p>}</section>
    </div>
  </>;
}
