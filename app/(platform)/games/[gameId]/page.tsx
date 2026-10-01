import { notFound } from "next/navigation";
import { LearningGame } from "@/components/training/LearningGame";
import { requireTrainee } from "@/lib/auth";
import { GAME_IDS, type GameId } from "@/lib/learning-games";
export const metadata = { title: "Learning challenge" };
export default async function GamePage({ params }: { params: Promise<{ gameId: string }> }) {
  await requireTrainee();
  const { gameId } = await params;
  if (!GAME_IDS.includes(gameId as GameId)) notFound();
  return <LearningGame key={gameId} gameId={gameId as GameId} />;
}
