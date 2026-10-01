import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ActivityRunner } from "@/components/training/ActivityRunner";
import { MiniGameRunner } from "@/components/training/MiniGameRunner";
import { LearningGame } from "@/components/training/LearningGame";
import { interactiveGameId } from "@/lib/learning-games";
import { isMiniGameActivityKind } from "@/lib/mini-games";
import { getPublishedModuleMetadata } from "@/lib/queries";
import { getRuntimeTrainingModule } from "@/lib/runtime-training";

export const metadata: Metadata = { title: "Interactive activity" };

export default async function ActivityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug === "hazard-perception") redirect("/training/hazard-perception/scene");
  const publishedModule = await getPublishedModuleMetadata(slug);
  const trainingModule = publishedModule ? getRuntimeTrainingModule(publishedModule) : null;
  if (!trainingModule || !publishedModule || !trainingModule.activities.length) notFound();
  const gameId = interactiveGameId(trainingModule.activities);
  if (gameId) return <LearningGame key={`${publishedModule.id}:${gameId}`} gameId={gameId} moduleId={publishedModule.id} moduleSlug={trainingModule.slug} />;
  if (isMiniGameActivityKind(trainingModule.activityKind)) {
    return <MiniGameRunner moduleId={publishedModule.id} moduleSlug={trainingModule.slug} moduleTitle={publishedModule.title} activityKind={trainingModule.activityKind} scenarios={trainingModule.activities} />;
  }
  return <ActivityRunner moduleId={publishedModule.id} moduleSlug={trainingModule.slug} moduleTitle={publishedModule.title} scenarios={trainingModule.activities} />;
}
