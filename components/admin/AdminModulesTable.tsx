"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpenCheck, CheckCircle2, FilePenLine, LoaderCircle, LockKeyhole, ShieldAlert, Trash2, XCircle } from "lucide-react";
import { DeleteModuleDialog } from "@/components/admin/module-authoring/DeleteModuleDialog";
import type { UserRole } from "@/types";
import { AutoDismissNotice } from "@/components/ui/AutoDismissNotice";
import { StatusBadge } from "@/components/ui/StatusBadge";

export interface AdminModuleRow {
  id: string;
  title: string;
  description: string;
  slug: string;
  estimated_minutes: number;
  difficulty: string;
  status: string;
  is_published: boolean;
  sort_order: number;
  is_authored: boolean;
  can_delete: boolean;
  updated_at: string | null;
  readiness: { ready: boolean; issues: string[] };
}

export function AdminModulesTable({ initialModules, role, initialNotice }: { initialModules: AdminModuleRow[]; role: UserRole; initialNotice?: string | null }) {
  const router = useRouter();
  const [modules, setModules] = useState(initialModules);
  const [saving, setSaving] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminModuleRow | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(
    initialNotice ? { tone: "success", text: initialNotice } : null,
  );
  const mutationPending = saving !== null || deleting;

  const summary = useMemo(() => ({
    total: modules.length,
    published: modules.filter((module) => module.is_published).length,
    drafts: modules.filter((module) => module.status === "draft" && !module.is_published).length,
    ready: modules.filter((module) => module.status === "draft" && !module.is_published && module.readiness.ready).length,
  }), [modules]);

  async function toggle(module: AdminModuleRow) {
    if (mutationPending) return;
    const published = !module.is_published;
    setSaving(module.id);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/modules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId: module.id, published }),
      });
      const payload = await response.json() as { error?: string; canDelete?: boolean };
      if (!response.ok) throw new Error(payload.error || "Publication status could not be updated.");
      setModules((items) => items.map((item) => item.id === module.id
        ? { ...item, is_published: published, status: published ? "published" : "draft", can_delete: payload.canDelete === true }
        : item));
      setNotice({ tone: "success", text: published ? `${module.title} is now available to trainees.` : `${module.title} is now a private draft.` });
      router.refresh();
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Publication status could not be updated." });
    } finally {
      setSaving(null);
    }
  }

  async function deleteModule() {
    if (!deleteTarget || mutationPending || !deleteTarget.can_delete || deleteTarget.is_published || deleteTarget.status !== "draft") return;
    setDeleting(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/modules/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedSlug: deleteTarget.slug, expectedUpdatedAt: deleteTarget.updated_at }),
      });
      const payload = await response.json() as { error?: string; cleanupPending?: boolean };
      if (!response.ok) throw new Error(payload.error || "The module draft could not be deleted.");
      setModules((items) => items.filter((item) => item.id !== deleteTarget.id));
      setNotice({
        tone: "success",
        text: payload.cleanupPending
          ? `${deleteTarget.title} was deleted. Its unused cover remains private and can be removed from Storage later.`
          : `${deleteTarget.title} was permanently deleted.`,
      });
      setDeleteTarget(null);
      router.refresh();
    } catch (error) {
      setDeleteTarget(null);
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "The module draft could not be deleted." });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <section className="module-catalogue-summary" aria-label="Module catalogue summary">
        <article><span>Catalogue</span><strong>{summary.total}</strong><small>Total modules</small></article>
        <article><span>Live</span><strong>{summary.published}</strong><small>Published</small></article>
        <article><span>Drafts</span><strong>{summary.drafts}</strong><small>Private</small></article>
        <article><span>Ready</span><strong>{summary.ready}</strong><small>Awaiting publish</small></article>
      </section>

      <section className="admin-table-card module-catalogue-card">
        <div className="module-catalogue-card-heading">
          <div><p className="section-kicker">Catalogue control</p><h2>Training modules</h2></div>
          <p><LockKeyhole size={15} /> Protected answers are never sent to trainees.</p>
        </div>
        {notice && <AutoDismissNotice key={`${notice.tone}-${notice.text}`} className={`table-message ${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"} onDismiss={() => setNotice(null)}>{notice.tone === "success" ? <CheckCircle2 size={17} /> : <XCircle size={17} />}{notice.text}</AutoDismissNotice>}
        <div className="responsive-table module-admin-table module-catalogue-table">
          <table>
            <thead><tr><th>Order</th><th>Module</th><th>Format</th><th>Readiness</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{modules.map((module) => (
              <tr key={module.id}>
                <td data-label="Order"><span className="module-order">{String(module.sort_order).padStart(2, "0")}</span></td>
                <td data-label="Module"><div className="module-catalogue-copy"><strong>{module.title}</strong><p>{module.description}</p><small>/{module.slug}</small></div></td>
                <td data-label="Format"><div className="module-format"><BookOpenCheck size={17} /><span><strong>{module.is_authored ? "Admin authored" : "Built-in"}</strong><small>{module.estimated_minutes} min · {module.difficulty}</small></span></div></td>
                <td data-label="Readiness">
                  <span className={`readiness-pill ${module.readiness.ready ? "ready" : "attention"}`}>
                    {module.readiness.ready ? <CheckCircle2 size={15} /> : <ShieldAlert size={15} />}
                    {module.readiness.ready ? "Ready" : "Needs content"}
                  </span>
                  {!module.readiness.ready && module.readiness.issues[0] && <small className="readiness-copy">{module.readiness.issues[0]}</small>}
                </td>
                <td data-label="Status"><StatusBadge status={module.status} /></td>
                <td data-label="Actions">
                  {role === "admin" ? <div className="module-admin-actions catalogue-actions">
                    {module.is_authored
                      ? <Link className="button button-secondary button-small" href={`/admin/training/${module.id}`}><FilePenLine size={16} /> {module.is_published ? "Review" : "Edit content"}</Link>
                      : <span className="built-in-note">Reviewed catalogue</span>}
                    <button
                      className={`publish-toggle ${module.is_published ? "on" : ""}`}
                      type="button"
                      onClick={() => void toggle(module)}
                      disabled={mutationPending || (!module.is_published && !module.readiness.ready)}
                      title={!module.is_published && !module.readiness.ready ? "Complete the readiness checklist before publishing." : undefined}
                      aria-label={`${module.is_published ? "Unpublish" : "Publish"} ${module.title}`}
                      aria-pressed={module.is_published}
                    >
                      {saving === module.id ? <LoaderCircle className="spin" size={16} /> : <i />}
                      <span>{module.is_published ? "Published" : "Publish"}</span>
                    </button>
                    {module.can_delete && module.status === "draft" && !module.is_published && <button
                      className="button button-secondary button-small catalogue-delete"
                      type="button"
                      onClick={() => setDeleteTarget(module)}
                      disabled={mutationPending}
                    ><Trash2 size={16} /> Delete</button>}
                  </div> : <StatusBadge status={module.is_published ? "published" : "unpublished"} />}
                </td>
              </tr>
            ))}</tbody>
          </table>
          {!modules.length && <div className="table-empty">No training modules are available.</div>}
        </div>
      </section>
      <DeleteModuleDialog open={deleteTarget !== null} moduleTitle={deleteTarget?.title ?? "module draft"} deleting={deleting} onClose={() => setDeleteTarget(null)} onConfirm={deleteModule} />
    </>
  );
}
