import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleDashed, Clock3, TrendingUp } from "lucide-react";
import { ProgressBar } from "@/components/motion/ProgressBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { requireTrainee } from "@/lib/auth";
import { getDashboardData } from "@/lib/queries";

export const metadata: Metadata = { title: "Progress" };
export default async function ProgressPage() {
  const viewer = await requireTrainee();
  const data = await getDashboardData(viewer.id);
  return (
    <>
      <header className="page-heading">
        <div><p className="section-kicker">Measured development</p><h1>Your training progress</h1><p>Progress is calculated from completed learning, activities and passed knowledge checks stored against your account.</p></div>
      </header>
      <section className="progress-overview">
        <div><p>Overall pathway</p><strong>{data.summary.overallProgress}<span>%</span></strong><ProgressBar value={data.summary.overallProgress} label="Overall progress" /></div>
        <dl><div><dt><CheckCircle2 /></dt><dd><strong>{data.summary.completedModules}</strong><span>modules completed</span></dd></div><div><dt><TrendingUp /></dt><dd><strong>{data.summary.safetyPoints}</strong><span>safety points</span></dd></div><div><dt><CircleDashed /></dt><dd><strong>{Math.max(0, data.summary.assignedModules - data.summary.completedModules)}</strong><span>modules remaining</span></dd></div></dl>
      </section>
      <section className="progress-modules">
        <div className="section-heading"><div><p className="section-kicker">Module detail</p><h2>Completion pathway</h2></div></div>
        {data.modules.length ? data.modules.map((module, index) => (
          <article key={module.id}>
            <span className="module-index">0{index + 1}</span>
            <div className="progress-module-main"><div><h3>{module.title}</h3><p>{module.category}</p></div><ProgressBar value={module.progressPercent} label={`${module.title} progress`} tone={module.progressPercent === 100 ? "green" : "blue"} /></div>
            <div className="progress-module-meta"><span><Clock3 /> {module.estimatedMinutes} min</span><StatusBadge status={module.status} /><Link href={module.resumeHref} aria-label={`${module.resumeLabel}: ${module.title}`}><ArrowRight /></Link></div>
          </article>
        )) : <EmptyState title="No progress records" description="Your pathway will appear when published or assigned modules are available." />}
      </section>
      <p className="calculation-note"><strong>Calculation rule:</strong> completed assigned modules divided by assigned modules. When no assignments exist, published modules form the pathway.</p>
    </>
  );
}
