import Link from "next/link";
import { ArrowRight, Boxes, Forklift, HardHat, Package } from "lucide-react";
import { requireTrainee } from "@/lib/auth";
import { GAME_IDS, GAME_NAMES } from "@/lib/learning-games";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import "@/components/training/learning-games.css";

export const metadata = { title: "Mini-Game to Learn" };
const cards = {
  forklift: { icon: Forklift, text: "Drive a warehouse route. Collect and deliver a load, yield at the crossing and park safely." },
  ppe: { icon: HardHat, text: "Equip individual PPE items for three different workplace assessments." },
  sorting: { icon: Package, text: "Sort stock, hazardous-material and waste cards into six destinations." },
  stacking: { icon: Boxes, text: "Plan five pallet placements across two rated bays. Balance weight, stability and damaged stock." },
};
export default async function GamesPage() {
  const viewer = await requireTrainee();
  const supabase = await createServerSupabaseClient();
  const saved = supabase ? await supabase.from("learning_game_runs").select("game_id,completed,score").eq("user_id",viewer.id).is("module_id",null) : null;
  const runs = new Map((saved?.data ?? []).map((run) => [run.game_id,run]));
  return <><header className="page-heading games-heading"><div><p className="section-kicker">Interactive learning</p><h1>Mini-Game to Learn</h1><p>Choose a challenge. Your moves and final score are saved separately from your assigned module assessments.</p></div></header>{(!saved || saved.error) && <p className="form-status error" role="status">Saved games are currently unavailable. Your administrator may need to finish the mini-game database setup.</p>}<div className="games-grid">{GAME_IDS.map((id) => { const game = cards[id], Icon = game.icon, run = runs.get(id); return <article className="games-card" key={id}><Icon size={32} /><h2>{GAME_NAMES[id]}</h2><p>{game.text}</p>{run && <strong>{run.completed ? `Completed · ${run.score}%` : "In progress · saved"}</strong>}<Link className="button button-primary" href={`/games/${id}`}>{run?.completed ? "Review result" : run ? "Resume challenge" : "Play challenge"}<ArrowRight size={18} /></Link></article>; })}</div></>;
}
