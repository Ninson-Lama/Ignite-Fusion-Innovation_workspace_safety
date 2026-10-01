import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpenCheck, CalendarClock, ChartNoAxesCombined, ClipboardCheck, Gauge, UsersRound } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireAdmin } from "@/lib/auth";
import { getAdminData, getReportsSummary } from "@/lib/queries";
import { AdminActivityFeed } from "@/components/admin/AdminActivityFeed";

export const metadata: Metadata = { title: "Management dashboard" };

export default async function AdminDashboardPage() {
  await requireAdmin();
  const [data, summary] = await Promise.all([getAdminData(), getReportsSummary()]);
  const trainees = data.profiles.filter((profile) => profile.role === "trainee" && profile.status === "active");
  const traineeIds = new Set(trainees.map((profile) => profile.id));
  const traineeProgress = data.progress.filter((record) => traineeIds.has(record.user_id));
  const traineeAttempts = data.attempts.filter((attempt) => traineeIds.has(attempt.user_id));
  const completed = traineeProgress.filter((record) => record.status === "completed");
  const average = traineeAttempts.length
    ? Math.round(traineeAttempts.reduce((sum, attempt) => sum + attempt.percentage, 0) / traineeAttempts.length)
    : null;
  const activeAssignments = data.assignments.filter((assignment) => traineeIds.has(assignment.user_id) && assignment.status !== "cancelled");
  const today = new Date().toISOString().slice(0, 10);
  const overdue = activeAssignments.filter((assignment) =>
    assignment.due_date && assignment.due_date < today && ["assigned", "in_progress"].includes(assignment.status),
  );
  const published = data.modules.filter((module) => module.is_published);
  const moduleRates = data.modules.map((module) => {
    const moduleRecords = traineeProgress.filter((record) => record.module_id === module.id);
    const completeCount = moduleRecords.filter((record) => record.status === "completed").length;
    return {
      id: module.id,
      title: module.title,
      rate: moduleRecords.length ? Math.round((completeCount / moduleRecords.length) * 100) : 0,
      count: moduleRecords.length,
    };
  });

  const activeTrainees = summary?.totalTrainees ?? trainees.length;
  const completedAssignments = summary?.completedAssignments ?? completed.length;
  const averageScore = summary ? (summary.averageQuizPercentage === null ? null : Math.round(summary.averageQuizPercentage)) : average;
  const overdueCount = summary?.overdueAssignments ?? overdue.length;

  return <>
    <header className="page-heading admin-heading">
      <div><p className="section-kicker">Authorised oversight</p><h1>Safety performance overview</h1><p>Organisation-wide trainee activity, assignments and training controls.</p></div>
      <Link className="button button-primary" href="/admin/assignments">Assign training <ArrowRight size={18} /></Link>
    </header>

    <section className="admin-kpis">
      <article><span><UsersRound /></span><p>Active trainees</p><strong>{activeTrainees}</strong><small>Visible in current scope</small></article>
      <article><span><ClipboardCheck /></span><p>Completed assignments</p><strong>{completedAssignments}</strong><small>Persisted completions</small></article>
      <article><span><Gauge /></span><p>Average latest score</p><strong>{averageScore === null ? "—" : `${averageScore}%`}</strong><small>{summary ? "Latest attempt per module" : average === null ? "No results yet" : `${traineeAttempts.length} recorded attempts`}</small></article>
      <article className={overdueCount ? "attention" : ""}><span><CalendarClock /></span><p>Overdue training</p><strong>{overdueCount}</strong><small>Assigned or in progress</small></article>
    </section>

    <div className="admin-dashboard-grid">
      <section className="report-card">
        <div className="section-heading"><div><p className="section-kicker">Completion</p><h2>Module completion rate</h2></div><Link href="/admin/reports">Full report <ArrowRight /></Link></div>
        {moduleRates.some((item) => item.count) ? <div className="bar-report">{moduleRates.map((item) => <div key={item.id}><div><strong>{item.title}</strong><span>{item.rate}%</span></div><i><span style={{ width: `${item.rate}%` }} /></i><small>{item.count} progress record{item.count === 1 ? "" : "s"}</small></div>)}</div> : <EmptyState title="No completion data" description="Completion rates will appear when trainees start assigned modules." />}
      </section>
      <AdminActivityFeed />
    </div>

    <section className="module-status-band">
      <div><BookOpenCheck /><p><strong>{published.length} modules published</strong><span>{data.modules.length - published.length} currently unpublished</span></p></div>
      <Link href="/admin/training">Manage modules <ArrowRight /></Link>
      <div><ChartNoAxesCombined /><p><strong>{summary?.totalAssignments ?? activeAssignments.length} assignments</strong><span>{summary?.usersRequiringReview ?? overdueCount} requiring attention</span></p></div>
    </section>
  </>;
}
