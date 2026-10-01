import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AdminModuleCreateForm } from "@/components/admin/AdminModuleCreateForm";
import { requireAdmin } from "@/lib/auth";
import { getNextAdminModuleOrder } from "@/lib/queries";

export const metadata: Metadata = { title: "Create training module" };

export default async function CreateTrainingModulePage() {
  await requireAdmin();
  const nextSortOrder = await getNextAdminModuleOrder();
  return (
    <div className="module-create-page">
      <Link className="back-link" href="/admin/training"><ArrowLeft size={17} /> Module management</Link>
      <header className="page-heading">
        <div><p className="section-kicker">New private draft</p><h1>Start with the module brief</h1><p>Set the catalogue details and learning goals. You will add the lesson, practical decisions and protected assessment in the next workspace.</p></div>
      </header>
      <AdminModuleCreateForm initialSuggestedOrder={nextSortOrder} />
    </div>
  );
}
