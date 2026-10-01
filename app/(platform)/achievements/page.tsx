import type { Metadata } from "next";
import { Award, Check, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireTrainee } from "@/lib/auth";
import { getAchievements } from "@/lib/queries";

export const metadata: Metadata = { title: "Achievements" };
export default async function AchievementsPage() {
  const viewer = await requireTrainee();
  const achievements = await getAchievements(viewer.id);
  const earned = achievements.filter((item) => item.earnedAt).length;
  return <><header className="page-heading achievement-heading"><div><p className="section-kicker">Professional milestones</p><h1>Achievements</h1><p>Recognising observable progress across practical safety activities and knowledge checks.</p></div><div><Award /><strong>{earned}</strong><span>earned</span></div></header>{achievements.length ? <section className="achievement-grid">{achievements.map((achievement, index) => <article className={achievement.earnedAt ? "earned" : "locked"} key={achievement.id}><div className="achievement-mark">{achievement.earnedAt ? <Check /> : <LockKeyhole />}</div><span className="achievement-code">IFI / {String(index + 1).padStart(2, "0")}</span><h2>{achievement.title}</h2><p>{achievement.description}</p><footer><span>{achievement.points} pts</span><strong>{achievement.earnedAt ? `Earned ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(achievement.earnedAt))}` : "Not yet earned"}</strong></footer></article>)}</section> : <EmptyState title="Achievement catalogue unavailable" description="Apply the Supabase seed data to publish the professional milestone catalogue." />}<section className="achievement-principle"><Sparkles /><div><h2>Restrained, evidence-based recognition</h2><p>Achievements are awarded only when their persisted criteria are met. They support engagement but do not represent regulatory certification.</p></div><ShieldCheck /></section></>;
}
