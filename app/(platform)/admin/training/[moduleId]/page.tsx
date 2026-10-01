import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ModuleEditor } from "@/components/admin/module-authoring/ModuleEditor";
import { requireAdmin } from "@/lib/auth";
import { getAdminModuleDraft } from "@/lib/queries";

export const metadata: Metadata = { title: "Module authoring" };

export default async function ModuleAuthoringPage({
  params,
  searchParams,
}: {
  params: Promise<{ moduleId: string }>;
  searchParams: Promise<{ cover?: string }>;
}) {
  await requireAdmin();
  const draft = await getAdminModuleDraft((await params).moduleId);
  if (!draft || !draft.editable) notFound();
  const coverRetry = (await searchParams).cover === "retry";
  return <div className="module-authoring-page"><Link className="back-link" href="/admin/training"><ArrowLeft size={17} /> Module management</Link><ModuleEditor initialDraft={draft} initialNotice={coverRetry ? "The draft was created, but its cover upload did not finish. Choose the image again below." : null} /></div>;
}
