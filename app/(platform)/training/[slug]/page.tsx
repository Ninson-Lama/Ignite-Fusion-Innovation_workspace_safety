import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CircleDashed, Clock3, Gauge, ShieldCheck } from "lucide-react";
import { CheckpointLink, TrainingProgressTracker } from "@/components/training/TrainingProgressTracker";
import { requireTrainee } from "@/lib/auth";
import { getMiniGameTemplate, isMiniGameActivityKind } from "@/lib/mini-games";
import { getPublishedModuleMetadata, getTrainingLibrary } from "@/lib/queries";
import { getRuntimeTrainingModule } from "@/lib/runtime-training";
import { learningSectionPosition } from "@/lib/training-resume";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const slug = (await params).slug;
  const publishedModule = await getPublishedModuleMetadata(slug);
  return publishedModule
    ? { title: publishedModule.title, description: publishedModule.description }
    : { title: "Module not found" };
}

export default async function ModulePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const viewer = await requireTrainee();
  const [publishedModule, library] = await Promise.all([
    getPublishedModuleMetadata(slug),
    getTrainingLibrary(viewer.id),
  ]);
  const trainingModule = publishedModule ? getRuntimeTrainingModule(publishedModule) : null;
  if (!trainingModule || !publishedModule) notFound();
  const libraryModule = library.find((module) => module.id === publishedModule.id);
  const currentProgress = libraryModule?.progressPercent ?? 0;
  const activityHref = trainingModule.slug === "hazard-perception" ? "/training/hazard-perception/scene" : `/training/${trainingModule.slug}/activity`;
  const miniGame = getMiniGameTemplate(trainingModule.activityKind);
  const resumeStage = libraryModule?.resumeStage ?? "overview";
  const actionStage = resumeStage === "quiz" ? "quiz" : "activity";
  const actionHref = resumeStage === "activity" || resumeStage === "quiz" ? libraryModule?.resumeHref ?? activityHref : activityHref;
  const defaultActionLabel = resumeStage === "quiz"
    ? "Resume knowledge check"
    : resumeStage === "activity"
      ? "Resume activity"
      : currentProgress === 100 ? "Review activity" : "Start activity";
  const actionLabel = isMiniGameActivityKind(trainingModule.activityKind) && resumeStage !== "quiz"
    ? resumeStage === "activity"
      ? "Resume challenge"
      : currentProgress === 100 ? "Review challenge" : "Start challenge"
    : defaultActionLabel;

  return (
    <article className="module-detail">
      <TrainingProgressTracker
        moduleId={publishedModule.id}
        sectionCount={trainingModule.learning.length}
        enabled={resumeStage === "overview" || resumeStage === "learning"}
      />
      <Link className="back-link" href="/training"><ArrowLeft size={17} /> Training library</Link>
      <header className={`module-detail-hero ${trainingModule.visualClass}`}>
        <div className="module-detail-copy"><p className="eyebrow eyebrow-light"><span /> {trainingModule.label}</p><h1>{publishedModule.title}</h1><p>{publishedModule.description}</p><div className="module-facts"><span><Clock3 /> <strong>{publishedModule.estimatedMinutes} min</strong><small>Estimated duration</small></span><span><Gauge /> <strong>{publishedModule.difficulty.replaceAll("_", " ")}</strong><small>Difficulty</small></span><span><ShieldCheck /> <strong>{publishedModule.passMark}%</strong><small>Project pass threshold</small></span><span><CircleDashed /> <strong>{currentProgress}%</strong><small>Current progress</small></span></div></div>
        <div className="module-detail-visual">
          <Image
            className="module-detail-preview"
            src={trainingModule.heroImagePath}
            alt={trainingModule.heroImageAlt}
            fill
            sizes="(max-width: 1080px) 100vw, 46vw"
            quality={90}
            loading="eager"
          />
        </div>
      </header>

      <section className="objectives-section"><div><p className="section-kicker">Learning objectives</p><h2>What you will be able to do</h2></div><ol>{trainingModule.objectives.map((objective, index) => <li key={objective}><span>0{index + 1}</span><p>{objective}</p></li>)}</ol></section>

      <section className="learning-section"><div className="section-heading"><div><p className="section-kicker">Core learning</p><h2>Use a deliberate safety routine</h2></div><span>{trainingModule.learning.length} key principles</span></div><div className="learning-grid">{trainingModule.learning.map((section, index) => {
        const position = learningSectionPosition(index, trainingModule.learning.length);
        return <article id={`learning-${position}`} data-resume-position={position} key={section.title}><span>0{index + 1}</span><h3>{section.title}</h3><p>{section.summary}</p><ul>{section.points.map((point) => <li key={point}><Check size={15} /> {point}</li>)}</ul></article>;
      })}</div></section>

      <section className="module-action-band"><div><p className="section-kicker">{miniGame ? "Interactive mini-game" : "Interactive activity"}</p><h2>{trainingModule.slug === "hazard-perception" ? "Enter the warehouse in 360°" : miniGame?.name ?? "Make the safer decision under pressure"}</h2><p>{trainingModule.slug === "hazard-perception" ? "Inspect the panoramic operation, identify seven unique hazards and receive corrective-action feedback." : miniGame ? `${miniGame.description} Complete ${trainingModule.activities.length} saved rounds before the knowledge check.` : `Work through ${trainingModule.activities.length} realistic decisions with immediate feedback before the knowledge check.`}</p></div><CheckpointLink className="button button-primary" moduleId={publishedModule.id} stage={actionStage} position={resumeStage === "quiz" ? 100 : 0} href={actionHref}>{actionLabel} <ArrowRight size={18} /></CheckpointLink></section>

      <p className="training-disclaimer">This internal learning supports workplace awareness. It is not a formal qualification and does not replace site procedures, task-specific instruction or competent supervision.</p>
    </article>
  );
}
