"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  Boxes,
  CheckCircle2,
  Forklift,
  Gamepad2,
  HardHat,
  ImagePlus,
  ListChecks,
  LoaderCircle,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { slugifyModuleTitle } from "@/lib/module-catalogue";
import { MODULE_COVER_MAX_BYTES } from "@/lib/module-covers";
import { AutoDismissNotice } from "@/components/ui/AutoDismissNotice";
import { MINI_GAME_TEMPLATES, type ActivityKind } from "@/lib/mini-games";

interface AdminModuleCreateFormProps {
  initialSuggestedOrder: number;
}

const initialForm = {
  title: "",
  slug: "",
  description: "",
  overview: "",
  category: "Operational safety",
  estimatedMinutes: 20,
  difficulty: "introductory",
  passMark: 80,
  pointsAvailable: 200,
  learningObjectives: "",
  activityKind: "decision" as ActivityKind,
};

function ActivityTypeIcon({ kind }: { kind: ActivityKind }) {
  if (kind === "forklift_precheck") return <Forklift aria-hidden="true" />;
  if (kind === "ppe_dress_up") return <HardHat aria-hidden="true" />;
  if (kind === "sorting_zone") return <ArrowLeftRight aria-hidden="true" />;
  if (kind === "load_stacking") return <Boxes aria-hidden="true" />;
  return <ListChecks aria-hidden="true" />;
}

export function AdminModuleCreateForm({ initialSuggestedOrder }: AdminModuleCreateFormProps) {
  const router = useRouter();
  const [form, setForm] = useState(initialForm);
  const [sortOrder, setSortOrder] = useState(initialSuggestedOrder);
  const [slugEdited, setSlugEdited] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [savingPhase, setSavingPhase] = useState<"creating" | "cover" | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const saving = savingPhase !== null;

  useEffect(() => {
    return () => {
      if (coverPreviewUrl) URL.revokeObjectURL(coverPreviewUrl);
    };
  }, [coverPreviewUrl]);

  function update<K extends keyof typeof initialForm>(key: K, value: (typeof initialForm)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function chooseCover(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;
    if (!file.size || file.size > MODULE_COVER_MAX_BYTES || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setCoverFile(null);
      setCoverPreviewUrl(null);
      setNotice({ tone: "error", text: "Choose a valid JPG, PNG or WebP image no larger than 4 MB." });
      return;
    }
    setCoverFile(file);
    setCoverPreviewUrl(URL.createObjectURL(file));
    setNotice(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSavingPhase("creating");
    setNotice(null);

    try {
      const response = await fetch("/api/admin/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          sortOrder,
          learningObjectives: form.learningObjectives
            .split("\n")
            .map((item) => item.trim())
            .filter(Boolean),
        }),
      });
      const payload = await response.json() as { module?: { id?: string; title?: string }; updatedAt?: string | null; error?: string };
      if (!response.ok || !payload.module) throw new Error(payload.error || "The module could not be created.");

      if (!payload.module.id) throw new Error("The new module could not be opened.");
      if (coverFile) {
        setSavingPhase("cover");
        try {
          const coverData = new FormData();
          coverData.set("file", coverFile);
          if (payload.updatedAt) coverData.set("expectedUpdatedAt", payload.updatedAt);
          const coverResponse = await fetch(`/api/admin/modules/${payload.module.id}/cover`, {
            method: "POST",
            body: coverData,
          });
          const coverPayload = await coverResponse.json() as { error?: string };
          if (!coverResponse.ok || coverPayload.error) throw new Error(coverPayload.error || "Cover upload failed.");
        } catch {
          // The draft already exists. Send the admin to its editor so retrying
          // the image cannot accidentally create a second module with the same slug.
          router.push(`/admin/training/${payload.module.id}?cover=retry`);
          return;
        }
      }
      router.push(`/admin/training/${payload.module.id}`);
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "The module could not be created." });
    } finally {
      setSavingPhase(null);
    }
  }

  return (
    <section className="module-create-card module-create-page-card">
        <form className="module-create-form module-create-page-form" onSubmit={submit} aria-busy={saving}>
          <fieldset className="module-create-fieldset" disabled={saving}>
          <div className="module-create-intro">
            <ShieldCheck size={22} />
            <p><strong>Safe publishing workflow</strong><span>New modules remain private drafts until reviewed learning, activity and assessment content is ready.</span></p>
          </div>

          {notice && (
            <AutoDismissNotice
              key={`${notice.tone}-${notice.text}`}
              className={`table-message module-create-notice ${notice.tone}`}
              role={notice.tone === "error" ? "alert" : "status"}
              onDismiss={() => setNotice(null)}
            >
              {notice.tone === "success" ? <CheckCircle2 size={17} /> : <XCircle size={17} />}
              {notice.text}
            </AutoDismissNotice>
          )}

          <div className="module-create-grid">
            <label className="plain-field module-create-wide"><span>Module title</span><input required minLength={3} maxLength={120} value={form.title} onChange={(event) => {
              const title = event.target.value;
              update("title", title);
              if (!slugEdited) update("slug", slugifyModuleTitle(title));
            }} placeholder="e.g. Lockout and tagout essentials" /></label>
            <label className="plain-field"><span>URL slug</span><input required minLength={3} maxLength={80} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={form.slug} onChange={(event) => {
              setSlugEdited(true);
              update("slug", slugifyModuleTitle(event.target.value));
            }} placeholder="lockout-tagout" /></label>
            <label className="plain-field"><span>Category</span><input required minLength={2} maxLength={80} value={form.category} onChange={(event) => update("category", event.target.value)} /></label>
            <label className="plain-field module-create-wide"><span>Short description</span><textarea required minLength={10} maxLength={800} rows={3} value={form.description} onChange={(event) => update("description", event.target.value)} placeholder="Explain what trainees will learn and why it matters." /></label>
            <label className="plain-field module-create-wide"><span>Module overview</span><textarea required minLength={20} maxLength={2000} rows={4} value={form.overview} onChange={(event) => update("overview", event.target.value)} placeholder="Summarise the scope, expected decisions and workplace context." /></label>
            <label className="plain-field"><span>Duration (minutes)</span><input required type="number" min={5} max={240} value={form.estimatedMinutes} onChange={(event) => update("estimatedMinutes", Number(event.target.value))} /></label>
            <label className="plain-field"><span>Difficulty</span><select value={form.difficulty} onChange={(event) => update("difficulty", event.target.value)}><option value="introductory">Introductory</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label>
            <label className="plain-field"><span>Pass mark (%)</span><input required type="number" min={1} max={100} value={form.passMark} onChange={(event) => update("passMark", Number(event.target.value))} /></label>
            <label className="plain-field"><span>Points available</span><input required type="number" min={0} max={5000} value={form.pointsAvailable} onChange={(event) => update("pointsAvailable", Number(event.target.value))} /></label>
            <label className="plain-field"><span>Catalogue order</span><input required type="number" min={0} max={10000} value={sortOrder} onChange={(event) => setSortOrder(Number(event.target.value))} /></label>
            <label className="plain-field module-create-objectives"><span>Learning objectives <small>One objective per line</small></span><textarea required rows={5} value={form.learningObjectives} onChange={(event) => update("learningObjectives", event.target.value)} placeholder={"Recognise the primary risks\nSelect the correct control\nReport unsafe conditions"} /></label>
          </div>

          <section className="module-activity-picker" aria-labelledby="new-module-activity-title">
            <div className="module-activity-picker-heading">
              <Gamepad2 size={21} aria-hidden="true" />
              <div>
                <strong id="new-module-activity-title">Choose the trainee activity</strong>
                <span>A standard decision activity starts empty. A mini-game starts with four editable, protected rounds.</span>
              </div>
            </div>
            <div className="module-activity-options">
              <label className={form.activityKind === "decision" ? "selected" : ""}>
                <input
                  type="radio"
                  name="activityKind"
                  value="decision"
                  checked={form.activityKind === "decision"}
                  onChange={() => update("activityKind", "decision")}
                />
                <span className="module-activity-icon"><ActivityTypeIcon kind="decision" /></span>
                <span className="module-activity-copy">
                  <strong>Decision scenarios</strong>
                  <small>Build ordinary workplace questions with protected feedback.</small>
                </span>
                <span className="module-activity-tag">Standard</span>
              </label>
              {MINI_GAME_TEMPLATES.map((template) => (
                <label className={form.activityKind === template.id ? "selected" : ""} key={template.id}>
                  <input
                    type="radio"
                    name="activityKind"
                    value={template.id}
                    checked={form.activityKind === template.id}
                    onChange={() => update("activityKind", template.id)}
                  />
                  <span className="module-activity-icon"><ActivityTypeIcon kind={template.id} /></span>
                  <span className="module-activity-copy">
                    <strong>{template.name}</strong>
                    <small>{template.description}</small>
                  </span>
                  <span className="module-activity-tag">Mini-game</span>
                </label>
              ))}
            </div>
          </section>

          <section className="module-create-cover" aria-labelledby="new-module-cover-title">
            <div>
              <ImagePlus size={20} />
              <p><strong id="new-module-cover-title">Optional cover image</strong><span>Choose a clear 16:9 JPG, PNG or WebP from this device. Maximum size: 4 MB.</span></p>
            </div>
            <div className="module-create-cover-picker">
              <label>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseCover} />
                <span className="module-create-cover-preview">
                  {coverPreviewUrl
                    ? <Image src={coverPreviewUrl} alt="Selected module cover preview" fill sizes="280px" unoptimized />
                    : <Upload size={24} />}
                </span>
                <span><strong>{coverFile ? "Replace image" : "Choose image"}</strong><small>{coverFile?.name ?? "You can also add this later in the editor."}</small></span>
              </label>
              {coverFile && <button type="button" onClick={() => { setCoverFile(null); setCoverPreviewUrl(null); }}><Trash2 size={16} /> Remove</button>}
            </div>
          </section>

          <div className="module-create-actions">
            <p>The module will not appear to trainees until its full content is reviewed and published.</p>
            <button className="button button-primary" type="submit" disabled={saving}>{saving ? <LoaderCircle className="spin" /> : <Plus size={18} />} {savingPhase === "cover" ? "Uploading cover…" : savingPhase === "creating" ? "Creating draft…" : "Create draft module"}</button>
          </div>
          </fieldset>
        </form>
    </section>
  );
}
