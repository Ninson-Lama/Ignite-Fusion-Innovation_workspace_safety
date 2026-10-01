import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { AdminModulesTable } from "@/components/admin/AdminModulesTable";
import { requireAdmin } from "@/lib/auth";
import { getAdminModulesWithReadiness } from "@/lib/queries";

export const metadata: Metadata = { title: "Module management" };
export default async function AdminTrainingPage({ searchParams }: { searchParams: Promise<{ deleted?: string; coverCleanup?: string }> }) {
  const viewer = await requireAdmin();
  const modules = await getAdminModulesWithReadiness();
  const query = await searchParams;
  const initialNotice = query.deleted
    ? query.coverCleanup === "pending"
      ? `${query.deleted} was deleted. Its unused cover remains private and can be removed from Storage later.`
      : `${query.deleted} was permanently deleted.`
    : null;
  return <><header className="page-heading admin-catalogue-heading"><div><p className="section-kicker">Training catalogue</p><h1>Module management</h1><p>Create complete learning experiences, review readiness and control exactly what trainees can access.</p></div><Link className="button button-primary" href="/admin/training/new"><Plus size={18} /> Create module</Link></header><AdminModulesTable initialModules={modules} role={viewer.role} initialNotice={initialNotice} /><p className="calculation-note"><strong>Safe publishing:</strong> answer keys and scenario feedback remain private, and publishing stays locked until every required section passes review.</p></>;
}
