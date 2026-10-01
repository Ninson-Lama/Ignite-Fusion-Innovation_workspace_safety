import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Award, BookOpen, CalendarClock, CheckCircle2, Clock3, Gauge, Trophy } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressBar } from "@/components/motion/ProgressBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { requireTrainee } from "@/lib/auth";
import { getDashboardData } from "@/lib/queries";

export const metadata: Metadata = { title: "Dashboard" };

function activityLabel(value: string) {
  return value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

export default async function DashboardPage() {
  const viewer = await requireTrainee();
  const data = await getDashboardData(viewer.id);
  const nextModule = data.modules.find((module) => module.status !== "completed");
  const today = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

  return (
    <>
      <header className="page-heading dashboard-heading">
        <div><p className="page-date">{today}</p><h1>Good day, {viewer.fullName.split(" ")[0]}</h1><p>Your training workspace is ready. Continue with the next safety-critical action.</p></div>
        <Link className="button button-secondary" href="/training"><BookOpen size={18} /> Training library</Link>
      </header>

      <section className="dashboard-hero">
        <div className="dashboard-progress-block">
          <p className="eyebrow eyebrow-light"><span /> Overall pathway</p>
          <div className="progress-number"><strong>{data.summary.overallProgress}</strong><span>%</span></div>
          <p>{data.summary.completedModules} of {data.summary.assignedModules} available modules completed</p>
          <ProgressBar value={data.summary.overallProgress} label="Overall training progress" />
        </div>
        <div className="dashboard-next-block">
          {nextModule ? <>
            <div className="next-module-top"><span>Next training</span><StatusBadge status={nextModule.status} /></div>
            <h2>{nextModule.title}</h2><p>{nextModule.description}</p>
            <div className="module-meta-row"><span><Clock3 size={15} /> {nextModule.estimatedMinutes} min</span>{nextModule.dueDate && <span><CalendarClock size={15} /> Due {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(nextModule.dueDate))}</span>}</div>
            <Link className="button button-primary" href={nextModule.resumeHref}>{nextModule.progressPercent ? nextModule.resumeLabel : "Start module"} <ArrowRight size={18} /></Link>
          </> : <div className="hero-empty"><CheckCircle2 size={28} /><h2>No training waiting</h2><p>There are no available modules requiring action.</p></div>}
        </div>
      </section>

      <section className="kpi-row" aria-label="Training summary">
        <article><span className="kpi-icon"><Gauge /></span><div><p>Latest assessment</p><strong>{data.summary.latestScore === null ? "—" : `${data.summary.latestScore}%`}</strong><small>{data.summary.latestScore === null ? "No attempt recorded" : "Most recent score"}</small></div></article>
        <article><span className="kpi-icon"><Trophy /></span><div><p>Safety points</p><strong>{data.summary.safetyPoints.toLocaleString("en-GB")}</strong><small>Persisted training total</small></div></article>
        <article><span className="kpi-icon"><Award /></span><div><p>Current rank</p><strong>{data.summary.rank ? `#${data.summary.rank}` : "—"}</strong><small>{data.summary.rank ? "Leaderboard position" : "Complete training to rank"}</small></div></article>
      </section>

      <div className="dashboard-lower-grid">
        <section className="content-section">
          <div className="section-heading"><div><p className="section-kicker">Your pathway</p><h2>Assigned training</h2></div><Link href="/training">View all <ArrowRight size={16} /></Link></div>
          {data.modules.length ? <div className="compact-module-list">{data.modules.slice(0, 3).map((module, index) => (
            <Link href={module.resumeHref} key={module.id}><span className="module-index">0{index + 1}</span><div><strong>{module.title}</strong><small>{module.category} · {module.estimatedMinutes} min</small><ProgressBar value={module.progressPercent} label={`${module.title} progress`} tone={module.progressPercent === 100 ? "green" : "blue"} /></div><ArrowRight size={18} /></Link>
          ))}</div> : <EmptyState title="No training assigned" description="Published or assigned modules will appear here when they are available." action={{ href: "/training", label: "Open library" }} />}
        </section>

        <section className="content-section activity-section">
          <div className="section-heading"><div><p className="section-kicker">Audit trail</p><h2>Recent activity</h2></div></div>
          {data.recentActivity.length ? <ol className="activity-timeline">{data.recentActivity.map((entry) => <li key={entry.id}><span /><div><strong>{activityLabel(entry.eventType)}</strong><p>{entry.moduleTitle || "Safety360 training"}</p><small>{new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(entry.createdAt))}</small></div></li>)}</ol>
            : <EmptyState title="No activity yet" description="Your completed training actions will create a secure activity record." />}
        </section>
      </div>

      <section className="achievement-strip">
        <div><p className="section-kicker">Professional milestones</p><h2>Latest achievements</h2><p>Recognition reflects training completed in Safety360; it is not a formal qualification.</p><Link href="/achievements">View achievements <ArrowRight size={16} /></Link></div>
        {data.achievements.length ? data.achievements.map((achievement) => <article key={achievement.id}><span><Award /></span><strong>{achievement.title}</strong><p>{achievement.description}</p><small>Earned {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(achievement.earnedAt))}</small></article>) : <div className="achievement-empty"><Award /><strong>Your first milestone is ahead</strong><p>Complete training activities to earn achievements.</p></div>}
      </section>
    </>
  );
}
