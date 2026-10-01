import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock3, LockKeyhole } from "lucide-react";
import { ProgressBar } from "@/components/motion/ProgressBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { requireTrainee } from "@/lib/auth";
import { getTrainingLibrary } from "@/lib/queries";
import { safeModuleHeroPath } from "@/lib/runtime-training";
import { CORE_MODULES, MODULE_PREVIEWS, PLANNED_MODULES } from "@/lib/training-data";

export const metadata: Metadata = { title: "Training library" };

export default async function TrainingPage() {
  const viewer = await requireTrainee();
  const modules = await getTrainingLibrary(viewer.id);

  return (
    <>
      <header className="page-heading training-heading"><div><p className="section-kicker">Learning library</p><h1>Training built around the operation</h1><p>Short learning, practical decisions and secure knowledge checks designed for automotive warehouse work.</p></div><div className="library-count"><strong>{modules.length}</strong><span>available modules</span></div></header>

      {modules.length ? <section className="module-library">
        {modules.map((module, index) => {
          const content = CORE_MODULES.find((item) => item.slug === module.slug);
          const preview = content ? MODULE_PREVIEWS[content.slug] : MODULE_PREVIEWS["hazard-perception"];
          const previewSrc = safeModuleHeroPath(module.heroImageUrl, preview.src);
          return <article className={`library-module ${content?.visualClass ?? "module-visual-default"}`} key={module.id}>
            <div className="module-visual-area">
              <Image
                className="module-preview-image"
                src={previewSrc}
                alt={content ? preview.alt : `${module.title} training preview`}
                fill
                sizes="(max-width: 1080px) 100vw, 46vw"
                quality={90}
                loading={index === 0 ? "eager" : "lazy"}
              />
            </div>
            <div className="module-copy-area">
              <div className="module-copy-top"><p>{module.category}</p><StatusBadge status={module.status} /></div>
              <h2>{module.title}</h2><p>{module.description}</p>
              <div className="module-meta-row"><span><Clock3 size={15} /> {module.estimatedMinutes} min</span><span>{module.difficulty}</span>{module.dueDate && <span>Due {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(module.dueDate))}</span>}</div>
              <ProgressBar value={module.progressPercent} label="Module progress" tone={module.progressPercent === 100 ? "green" : "blue"} />
              <Link className="button button-primary" href={module.resumeHref}>{module.resumeLabel}<ArrowRight size={18} /></Link>
            </div>
          </article>;
        })}
      </section> : <EmptyState title="No modules available" description="There are no published or assigned training modules available for this account. Contact your administrator if you expected training." />}

      <section className="planned-modules"><div className="section-heading"><div><p className="section-kicker">Future pathway</p><h2>Planned learning</h2></div></div><div>{PLANNED_MODULES.map((module) => <article key={module.title}><LockKeyhole size={18} /><div><strong>{module.title}</strong><small>{module.category}</small></div><span>Planned</span></article>)}</div></section>
    </>
  );
}
