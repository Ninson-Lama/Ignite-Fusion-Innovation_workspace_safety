import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { QuizRunner } from "@/components/training/QuizRunner";
import { EmptyState } from "@/components/ui/EmptyState";
import { getPublishedModuleMetadata, getQuizQuestions } from "@/lib/queries";

export const metadata: Metadata = { title: "Knowledge check" };

export default async function QuizPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const publishedModule = await getPublishedModuleMetadata(slug);
  if (!publishedModule) notFound();
  const questions = await getQuizQuestions(publishedModule.id);
  if (!questions.length) return (
    <section className="standalone-empty"><Link className="back-link" href={`/training/${slug}`}><ArrowLeft size={17} /> Back to module</Link><EmptyState title="Knowledge check unavailable" description="Questions are loaded from the protected Supabase training database. Apply the migration and seed data, then refresh this page." /><div className="security-note"><LockKeyhole size={18} /><p>Correct answer keys are held separately and are never included in this page.</p></div></section>
  );
  return <QuizRunner moduleId={publishedModule.id} moduleSlug={slug} moduleTitle={publishedModule.title} passMark={publishedModule.passMark} questions={questions} />;
}
