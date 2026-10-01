"use client";

import Image from "next/image";
import { interactiveGameId } from "@/lib/learning-games";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown, ArrowLeftRight, ArrowUp, BookOpenCheck, Boxes, Check, CheckCircle2,
  ClipboardCheck, Eye, FileText, Forklift, Gamepad2, HardHat, ImageIcon, Layers3,
  ListChecks, LoaderCircle, LockKeyhole, Plus, Save, ShieldAlert, ShieldCheck,
  Trash2, Upload, XCircle,
} from "lucide-react";
import { DeleteModuleDialog } from "@/components/admin/module-authoring/DeleteModuleDialog";
import { AutoDismissNotice } from "@/components/ui/AutoDismissNotice";
import { isCuratedModuleCoverPath, isUploadedModuleCoverPath, MODULE_COVER_MAX_BYTES } from "@/lib/module-covers";
import {
  getAuthoringReadiness,
  MODULE_HERO_OPTIONS,
  type AuthoredLearningSection,
  type AuthoredQuestion,
  type AuthoredScenario,
  type ModuleAuthoringDefinition,
} from "@/lib/module-authoring";
import type { AdminModuleDraft } from "@/lib/queries";
import {
  getMiniGameTemplate,
  isMiniGameActivityKind,
  MINI_GAME_TEMPLATES,
  miniGameScenarioPrefix,
  type ActivityKind,
} from "@/lib/mini-games";

const steps = [
  { id: "overview", label: "Overview", icon: FileText },
  { id: "learning", label: "Learning", icon: BookOpenCheck },
  { id: "practice", label: "Practice", icon: Layers3 },
  { id: "assessment", label: "Assessment", icon: ClipboardCheck },
  { id: "review", label: "Review & publish", icon: ShieldCheck },
] as const;

type StepId = (typeof steps)[number]["id"];

function nextId(prefix: string, values: Array<{ id: string }>) {
  const used = new Set(values.map((value) => value.id));
  let index = values.length + 1;
  while (used.has(`${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
}

function nextLetterId(values: Array<{ id: string }>) {
  const used = new Set(values.map((value) => value.id));
  return [..."abcdefghijklmnopqrstuvwxyz"].find((id) => !used.has(id)) ?? nextId("option", values);
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) return items;
  const next = [...items];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return next;
}

function ActivityTypeIcon({ kind }: { kind: ActivityKind }) {
  if (kind === "forklift_precheck") return <Forklift aria-hidden="true" />;
  if (kind === "ppe_dress_up") return <HardHat aria-hidden="true" />;
  if (kind === "sorting_zone") return <ArrowLeftRight aria-hidden="true" />;
  if (kind === "load_stacking") return <Boxes aria-hidden="true" />;
  return <ListChecks aria-hidden="true" />;
}

function ActivityKindPicker({ value, onChange }: { value: ActivityKind; onChange: (kind: ActivityKind) => void }) {
  return <section className="module-activity-picker authoring-activity-picker" aria-labelledby="activity-format-title">
    <div className="module-activity-picker-heading">
      <Gamepad2 size={21} aria-hidden="true" />
      <div><strong id="activity-format-title">Trainee activity format</strong><span>Choose ordinary decisions or a guided mini-game template.</span></div>
    </div>
    <div className="module-activity-options">
      <label className={value === "decision" ? "selected" : ""}>
        <input type="radio" name="activityKind" value="decision" checked={value === "decision"} onChange={() => onChange("decision")} />
        <span className="module-activity-icon"><ActivityTypeIcon kind="decision" /></span>
        <span className="module-activity-copy"><strong>Decision scenarios</strong><small>Standard workplace decisions and protected feedback.</small></span>
        <span className="module-activity-tag">Standard</span>
      </label>
      {MINI_GAME_TEMPLATES.map((template) => <label className={value === template.id ? "selected" : ""} key={template.id}>
        <input type="radio" name="activityKind" value={template.id} checked={value === template.id} onChange={() => onChange(template.id)} />
        <span className="module-activity-icon"><ActivityTypeIcon kind={template.id} /></span>
        <span className="module-activity-copy"><strong>{template.name}</strong><small>{template.interaction}</small></span>
        <span className="module-activity-tag">Mini-game</span>
      </label>)}
    </div>
  </section>;
}

function RepeaterActions({ label, index, count, onMove, onRemove }: {
  label: string;
  index: number;
  count: number;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  return <div className="repeater-actions">
    <button type="button" onClick={() => onMove(-1)} disabled={index === 0}><ArrowUp size={15} /> <span className="sr-only">Move {label} up</span></button>
    <button type="button" onClick={() => onMove(1)} disabled={index === count - 1}><ArrowDown size={15} /> <span className="sr-only">Move {label} down</span></button>
    <button className="repeater-delete" type="button" onClick={onRemove}><Trash2 size={15} /> <span className="sr-only">Delete {label}</span></button>
  </div>;
}

export function ModuleEditor({ initialDraft, initialNotice = null }: { initialDraft: AdminModuleDraft; initialNotice?: string | null }) {
  const router = useRouter();
  const [definition, setDefinition] = useState(initialDraft.definition);
  const [persistedSlug, setPersistedSlug] = useState(initialDraft.definition.slug);
  const [activeStep, setActiveStep] = useState<StepId>("overview");
  const [isPublished, setIsPublished] = useState(initialDraft.isPublished);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState(initialDraft.coverPreviewUrl);
  const [draftVersion, setDraftVersion] = useState(initialDraft.updatedAt);
  const [canDelete, setCanDelete] = useState(initialDraft.canDelete);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(
    initialNotice ? { tone: "error", text: initialNotice } : null,
  );
  const readiness = useMemo(() => getAuthoringReadiness(definition), [definition]);
  const busy = saving || publishing || uploadingCover || deleting;
  const gameTemplate = getMiniGameTemplate(definition.activityKind);

  useEffect(() => {
    function warnBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirty) return;
      event.preventDefault();
    }
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    function guardInternalNavigation(event: MouseEvent) {
      if (!dirty || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin || destination.href === window.location.href) return;

      event.preventDefault();
      event.stopPropagation();
      if (!window.confirm("Leave this module without saving your latest changes?")) return;
      setDirty(false);
      router.push(`${destination.pathname}${destination.search}${destination.hash}`);
    }
    document.addEventListener("click", guardInternalNavigation, true);
    return () => document.removeEventListener("click", guardInternalNavigation, true);
  }, [dirty, router]);

  function update(patch: Partial<ModuleAuthoringDefinition>) {
    setDefinition((current) => ({ ...current, ...patch }));
    setDirty(true);
  }

  function selectCuratedCover(heroImagePath: ModuleAuthoringDefinition["heroImagePath"]) {
    setCoverPreviewUrl(heroImagePath);
    update({ heroImagePath });
  }

  async function uploadCover(file: File) {
    if (busy) return;
    if (isPublished) {
      setNotice({ tone: "error", text: "Unpublish the module before replacing its cover image." });
      return;
    }
    if (!file.size || file.size > MODULE_COVER_MAX_BYTES) {
      setNotice({ tone: "error", text: "Choose a JPG, PNG or WebP image no larger than 4 MB." });
      return;
    }

    const hadUnsavedChanges = dirty;
    setUploadingCover(true);
    setNotice(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      if (draftVersion) formData.set("expectedUpdatedAt", draftVersion);
      const response = await fetch(`/api/admin/modules/${initialDraft.moduleId}/cover`, {
        method: "POST",
        body: formData,
      });
      const payload = await response.json() as { error?: string; heroImagePath?: string; coverPreviewUrl?: string | null; updatedAt?: string | null; cleanupPending?: boolean };
      if (!response.ok || !payload.heroImagePath) {
        throw new Error(payload.error || "The cover image could not be uploaded.");
      }
      setDefinition((current) => ({ ...current, heroImagePath: payload.heroImagePath as string }));
      setCoverPreviewUrl(payload.coverPreviewUrl ?? null);
      setDraftVersion(payload.updatedAt ?? draftVersion);
      setDirty(hadUnsavedChanges);
      setLastSaved(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      setNotice({
        tone: "success",
        text: payload.cleanupPending
          ? "Cover saved. The previous private image could not be removed and remains inaccessible to trainees."
          : hadUnsavedChanges
            ? "Cover uploaded. Save the remaining module changes when you are ready."
            : "Private cover image uploaded and saved.",
      });
      router.refresh();
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "The cover image could not be uploaded." });
    } finally {
      setUploadingCover(false);
    }
  }

  async function deleteDraft() {
    if (busy) return;
    setDeleting(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/modules/${initialDraft.moduleId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedSlug: persistedSlug, expectedUpdatedAt: draftVersion }),
      });
      const payload = await response.json() as { error?: string; cleanupPending?: boolean };
      if (!response.ok) throw new Error(payload.error || "The module draft could not be deleted.");
      setDirty(false);
      setDeleteDialogOpen(false);
      router.replace(`/admin/training?deleted=${encodeURIComponent(definition.title)}${payload.cleanupPending ? "&coverCleanup=pending" : ""}`);
      router.refresh();
    } catch (error) {
      setDeleteDialogOpen(false);
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "The module draft could not be deleted." });
    } finally {
      setDeleting(false);
    }
  }

  async function saveDraft() {
    if (busy) return false;
    if (isPublished) {
      setNotice({ tone: "error", text: "Unpublish the module before editing its content." });
      return false;
    }
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/admin/modules/${initialDraft.moduleId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ definition, expectedUpdatedAt: draftVersion }),
      });
      const payload = await response.json() as { error?: string; cleanupPending?: boolean; result?: { updatedAt?: string | null } };
      if (!response.ok) throw new Error(payload.error || "The private draft could not be saved.");
      setDirty(false);
      setPersistedSlug(definition.slug);
      setDraftVersion(payload.result?.updatedAt ?? draftVersion);
      setLastSaved(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      setNotice({
        tone: "success",
        text: payload.cleanupPending
          ? "Draft saved. The previous private cover could not be removed and remains inaccessible to trainees."
          : "Private module draft saved.",
      });
      router.refresh();
      return true;
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "The private draft could not be saved." });
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function changePublication(nextPublished: boolean) {
    if (busy) return;
    if (nextPublished && !readiness.ready) {
      setActiveStep("review");
      setNotice({ tone: "error", text: "Complete every readiness item before publishing." });
      return;
    }
    if (nextPublished && dirty && !(await saveDraft())) return;
    setPublishing(true);
    setNotice(null);
    try {
      const response = await fetch("/api/admin/modules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId: initialDraft.moduleId, published: nextPublished }),
      });
      const payload = await response.json() as { error?: string; canDelete?: boolean };
      if (!response.ok) throw new Error(payload.error || "Publication status could not be updated.");
      setIsPublished(nextPublished);
      setCanDelete(payload.canDelete === true);
      setNotice({ tone: "success", text: nextPublished ? "Module published to the trainee library." : "Module returned to a private draft." });
      router.refresh();
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Publication status could not be updated." });
    } finally {
      setPublishing(false);
    }
  }

  const completionByStep: Record<StepId, boolean> = {
    overview: readiness.steps.overview,
    learning: readiness.steps.learning,
    practice: readiness.steps.practice,
    assessment: readiness.steps.assessment,
    review: readiness.ready,
  };

  return (
    <div className="module-authoring-shell">
      <header className="authoring-header">
        <div><p className="section-kicker">Protected authoring workspace</p><h1>{definition.title}</h1><p>Build the lesson, {gameTemplate ? `${gameTemplate.shortName.toLowerCase()} mini-game` : "decision practice"} and assessment before releasing it to trainees.</p></div>
        <div className="authoring-status-cluster">
          <span className={`readiness-pill ${readiness.ready ? "ready" : "attention"}`}>{readiness.ready ? <CheckCircle2 size={15} /> : <ShieldAlert size={15} />}{readiness.ready ? "Ready to publish" : `${readiness.blockers.length} items to review`}</span>
          <span className={`authoring-live-state ${isPublished ? "live" : "draft"}`}>{isPublished ? "Published" : "Private draft"}</span>
        </div>
      </header>

      {notice && <AutoDismissNotice key={`${notice.tone}-${notice.text}`} className={`table-message authoring-notice ${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"} onDismiss={() => setNotice(null)}>{notice.tone === "success" ? <CheckCircle2 size={17} /> : <XCircle size={17} />}{notice.text}</AutoDismissNotice>}

      <div className="authoring-layout">
        <nav className="authoring-stepper" aria-label="Module authoring">
          <p>Build module</p>
          {steps.map((step, index) => {
            const Icon = step.icon;
            return <button key={step.id} type="button" className={activeStep === step.id ? "active" : ""} aria-current={activeStep === step.id ? "step" : undefined} onClick={() => setActiveStep(step.id)}>
              <span>{String(index + 1).padStart(2, "0")}</span><Icon size={18} /><strong>{step.id === "practice" && gameTemplate ? "Mini-game" : step.label}</strong>{completionByStep[step.id] ? <CheckCircle2 className="step-complete" size={16} /> : <i />}
            </button>;
          })}
          <div className="authoring-security-note"><LockKeyhole size={18} /><p><strong>Private by design</strong><span>Correct answers and feedback stay server-side.</span></p></div>
        </nav>

        <div className="authoring-canvas">
          {isPublished && <div className="published-edit-lock"><ShieldCheck size={19} /><p><strong>This module is live.</strong><span>Unpublish it before changing the reviewed content.</span></p><button className="button button-secondary button-small" type="button" onClick={() => void changePublication(false)} disabled={busy}>{publishing ? <LoaderCircle className="spin" /> : null} Unpublish to edit</button></div>}
          <fieldset className="authoring-fieldset" disabled={isPublished || busy}>
            {activeStep === "overview" && <OverviewEditor definition={definition} coverPreviewUrl={coverPreviewUrl} uploadingCover={uploadingCover} update={update} onSelectCuratedCover={selectCuratedCover} onUploadCover={uploadCover} />}
            {activeStep === "learning" && <LearningEditor definition={definition} update={update} />}
            {activeStep === "practice" && <PracticeEditor definition={definition} update={update} />}
            {activeStep === "assessment" && <AssessmentEditor definition={definition} update={update} />}
          </fieldset>
          {activeStep === "review" && <ReviewPanel definition={definition} coverPreviewUrl={coverPreviewUrl} readiness={readiness} moduleStatus={initialDraft.status} canDelete={canDelete} isPublished={isPublished} busy={busy} publishing={publishing} deleting={deleting} onPublish={changePublication} onStep={setActiveStep} onDelete={() => setDeleteDialogOpen(true)} />}
        </div>
      </div>

      <div className="authoring-action-bar" aria-live="polite">
        <div><span className={dirty ? "dirty" : "saved"}>{dirty ? "Unsaved changes" : lastSaved ? `Saved at ${lastSaved}` : "Private draft loaded"}</span><small>{readiness.ready ? "All required content is complete." : "You can save now and finish the remaining items later."}</small></div>
        <button className="button button-primary" type="button" onClick={() => void saveDraft()} disabled={busy || isPublished}>{saving ? <LoaderCircle className="spin" size={18} /> : <Save size={18} />} Save private draft</button>
      </div>
      <DeleteModuleDialog open={deleteDialogOpen} moduleTitle={definition.title} deleting={deleting} onClose={() => setDeleteDialogOpen(false)} onConfirm={deleteDraft} />
    </div>
  );
}

function SectionHeading({ eyebrow, title, description, count }: { eyebrow: string; title: string; description: string; count?: string }) {
  return <header className="authoring-section-heading"><div><p>{eyebrow}</p><h2>{title}</h2><span>{description}</span></div>{count && <strong>{count}</strong>}</header>;
}

function OverviewEditor({ definition, coverPreviewUrl, uploadingCover, update, onSelectCuratedCover, onUploadCover }: {
  definition: ModuleAuthoringDefinition;
  coverPreviewUrl: string | null;
  uploadingCover: boolean;
  update: (patch: Partial<ModuleAuthoringDefinition>) => void;
  onSelectCuratedCover: (path: ModuleAuthoringDefinition["heroImagePath"]) => void;
  onUploadCover: (file: File) => Promise<void>;
}) {
  function updateObjective(index: number, value: string) {
    const learningObjectives = [...definition.learningObjectives];
    learningObjectives[index] = value;
    update({ learningObjectives });
  }
  function handleCoverUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void onUploadCover(file);
  }
  return <section className="authoring-section">
    <SectionHeading eyebrow="01 / Overview" title="Set the learning brief" description="Define how the module appears in the catalogue and what trainees should be able to do." />
    <div className="authoring-form-grid">
      <label className="plain-field authoring-wide"><span>Module title</span><input required minLength={3} maxLength={120} value={definition.title} onChange={(event) => update({ title: event.target.value })} /></label>
      <label className="plain-field"><span>URL slug</span><input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={definition.slug} onChange={(event) => update({ slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} /></label>
      <label className="plain-field"><span>Category</span><input required value={definition.category} onChange={(event) => update({ category: event.target.value })} /></label>
      <label className="plain-field authoring-wide"><span>Short description</span><textarea rows={3} value={definition.description} onChange={(event) => update({ description: event.target.value })} /></label>
      <label className="plain-field authoring-wide"><span>Module overview</span><textarea rows={4} value={definition.overview} onChange={(event) => update({ overview: event.target.value })} /></label>
      <label className="plain-field"><span>Duration (minutes)</span><input type="number" min={5} max={240} value={definition.estimatedMinutes} onChange={(event) => update({ estimatedMinutes: Number(event.target.value) })} /></label>
      <label className="plain-field"><span>Difficulty</span><select value={definition.difficulty} onChange={(event) => update({ difficulty: event.target.value as ModuleAuthoringDefinition["difficulty"] })}><option value="introductory">Introductory</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label>
      <label className="plain-field"><span>Pass mark (%)</span><input type="number" min={1} max={100} value={definition.passMark} onChange={(event) => update({ passMark: Number(event.target.value) })} /></label>
      <label className="plain-field"><span>Points available</span><input type="number" min={0} max={5000} value={definition.pointsAvailable} onChange={(event) => update({ pointsAvailable: Number(event.target.value) })} /></label>
      <label className="plain-field"><span>Catalogue order</span><input type="number" min={0} max={10000} value={definition.sortOrder} onChange={(event) => update({ sortOrder: Number(event.target.value) })} /></label>
    </div>

    <div className="authoring-subsection">
      <div className="authoring-subsection-title"><div><h3>Learning objectives</h3><p>Use short, observable outcomes. At least two are required.</p></div><button className="button button-secondary button-small" type="button" onClick={() => update({ learningObjectives: [...definition.learningObjectives, ""] })} disabled={definition.learningObjectives.length >= 8}><Plus size={15} /> Add objective</button></div>
      <div className="objective-editor-list">{definition.learningObjectives.map((objective, index) => <div key={index}><span>{String(index + 1).padStart(2, "0")}</span><input aria-label={`Learning objective ${index + 1}`} value={objective} onChange={(event) => updateObjective(index, event.target.value)} /><button type="button" aria-label={`Remove learning objective ${index + 1}`} onClick={() => update({ learningObjectives: definition.learningObjectives.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 size={16} /></button></div>)}</div>
    </div>

    <div className="authoring-subsection">
      <div className="authoring-subsection-title"><div><h3>Cover image</h3><p>Choose a reviewed cover or upload a JPG, PNG or WebP from your device.</p></div><ImageIcon size={20} /></div>
      <div className="hero-option-grid">
        <label className={`cover-upload-option ${isUploadedModuleCoverPath(definition.heroImagePath) ? "selected" : ""}`}>
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleCoverUpload} />
          <span className="cover-upload-preview">
            {isUploadedModuleCoverPath(definition.heroImagePath) && coverPreviewUrl
              ? <Image src={coverPreviewUrl} alt="Current uploaded module cover" fill sizes="180px" />
              : <Upload size={25} />}
          </span>
          <strong>{uploadingCover ? "Uploading cover…" : isUploadedModuleCoverPath(definition.heroImagePath) ? "Replace device image" : "Choose from device"}</strong>
          <small>Private upload · 16:9 works best · 4 MB max</small>
          {uploadingCover ? <LoaderCircle className="spin" size={17} /> : isUploadedModuleCoverPath(definition.heroImagePath) && <CheckCircle2 size={17} />}
        </label>
        {MODULE_HERO_OPTIONS.map((option) => <label className={definition.heroImagePath === option.value ? "selected" : ""} key={option.value}><input type="radio" name="heroImage" value={option.value} checked={definition.heroImagePath === option.value} onChange={() => onSelectCuratedCover(option.value)} /><span><Image src={option.value} alt="" fill sizes="180px" /></span><strong>{option.label}</strong>{definition.heroImagePath === option.value && <CheckCircle2 size={17} />}</label>)}
      </div>
    </div>
  </section>;
}

function LearningEditor({ definition, update }: { definition: ModuleAuthoringDefinition; update: (patch: Partial<ModuleAuthoringDefinition>) => void }) {
  function changeSection(index: number, patch: Partial<AuthoredLearningSection>) {
    update({ learning: definition.learning.map((section, itemIndex) => itemIndex === index ? { ...section, ...patch } : section) });
  }
  function addSection() {
    update({ learning: [...definition.learning, { id: nextId("section", definition.learning), title: "", summary: "", points: ["", ""] }] });
  }
  return <section className="authoring-section">
    <SectionHeading eyebrow="02 / Learning" title="Build the core lesson" description="Turn the brief into concise sections trainees can scan and remember." count={`${definition.learning.length} / 12 sections`} />
    <div className="repeater-list">{definition.learning.map((section, index) => <article className="authoring-repeater" key={section.id}>
      <header><div><span>Section {String(index + 1).padStart(2, "0")}</span><strong>{section.title || "Untitled learning section"}</strong></div><RepeaterActions label={`learning section ${index + 1}`} index={index} count={definition.learning.length} onMove={(direction) => update({ learning: moveItem(definition.learning, index, direction) })} onRemove={() => update({ learning: definition.learning.filter((_, itemIndex) => itemIndex !== index) })} /></header>
      <div className="authoring-form-grid"><label className="plain-field"><span>Section title</span><input value={section.title} onChange={(event) => changeSection(index, { title: event.target.value })} /></label><label className="plain-field authoring-wide"><span>Plain-language summary</span><textarea rows={3} value={section.summary} onChange={(event) => changeSection(index, { summary: event.target.value })} /></label></div>
      <div className="point-editor"><div><strong>Key points</strong><button type="button" onClick={() => changeSection(index, { points: [...section.points, ""] })} disabled={section.points.length >= 6}><Plus size={14} /> Add point</button></div>{section.points.map((point, pointIndex) => <label key={pointIndex}><Check size={15} /><input aria-label={`Key point ${pointIndex + 1} for section ${index + 1}`} value={point} onChange={(event) => changeSection(index, { points: section.points.map((item, itemIndex) => itemIndex === pointIndex ? event.target.value : item) })} /><button type="button" aria-label={`Remove key point ${pointIndex + 1}`} onClick={() => changeSection(index, { points: section.points.filter((_, itemIndex) => itemIndex !== pointIndex) })}><Trash2 size={14} /></button></label>)}</div>
    </article>)}</div>
    <button className="authoring-add-card" type="button" onClick={addSection} disabled={definition.learning.length >= 12}><Plus size={20} /><span><strong>Add learning section</strong><small>Title, summary and memorable key points</small></span></button>
  </section>;
}

function PracticeEditor({ definition, update }: { definition: ModuleAuthoringDefinition; update: (patch: Partial<ModuleAuthoringDefinition>) => void }) {
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const template = getMiniGameTemplate(definition.activityKind);
  const isGame = isMiniGameActivityKind(definition.activityKind);
  const itemName = isGame ? "game round" : "scenario";
  const interactive = interactiveGameId(definition.scenarios);

  async function changeActivityKind(activityKind: ActivityKind, replaceLegacy = false) {
    if (loadingTemplate || (activityKind === definition.activityKind && !replaceLegacy)) return;
    if (
      definition.scenarios.length > 0
      && !window.confirm("Changing the activity format replaces the current practice content. Continue?")
    ) return;
    setLoadingTemplate(true);
    setTemplateError(null);
    try {
      let scenarios: AuthoredScenario[] = [];
      if (isMiniGameActivityKind(activityKind)) {
        const response = await fetch(`/api/admin/module-templates?kind=${activityKind}`, { cache: "no-store" });
        const payload = await response.json() as { scenarios?: AuthoredScenario[]; error?: string };
        if (!response.ok || !payload.scenarios) throw new Error(payload.error || "The game template could not be loaded.");
        scenarios = payload.scenarios;
      }
      update({ activityKind, scenarios });
    } catch (error) {
      setTemplateError(error instanceof Error ? error.message : "The game template could not be loaded.");
    } finally {
      setLoadingTemplate(false);
    }
  }

  function changeScenario(index: number, patch: Partial<AuthoredScenario>) {
    update({ scenarios: definition.scenarios.map((scenario, itemIndex) => itemIndex === index ? { ...scenario, ...patch } : scenario) });
  }
  function addScenario() {
    const prefix = template ? miniGameScenarioPrefix(template.id) : "scenario";
    update({ scenarios: [...definition.scenarios, { id: nextId(prefix, definition.scenarios), situation: "", prompt: "", choices: [
      { id: "a", label: "", feedback: "", isCorrect: true },
      { id: "b", label: "", feedback: "", isCorrect: false },
      { id: "c", label: "", feedback: "", isCorrect: false },
    ] }] });
  }
  return <section className="authoring-section">
    <SectionHeading
      eyebrow={isGame ? "03 / Mini-game" : "03 / Practice"}
      title={template ? `Build ${template.name}` : "Author practical decisions"}
      description={template ? `${template.description} Progress saves between visits and results are scored on the server.` : "Trainees see the situation and choices. Correctness and feedback remain protected until they answer."}
      count={interactive ? "Interactive mission · v1" : `${definition.scenarios.length} / 12 ${isGame ? "rounds" : "scenarios"}`}
    />
    <fieldset className="authoring-fieldset" disabled={loadingTemplate} aria-busy={loadingTemplate}>
      <ActivityKindPicker value={definition.activityKind} onChange={(kind) => void changeActivityKind(kind)} />
    </fieldset>
    {loadingTemplate && <p role="status"><LoaderCircle size={16} className="spin" /> Loading game template…</p>}
    {templateError && <AutoDismissNotice key={templateError} className="form-status error" role="alert" onDismiss={() => setTemplateError(null)}>{templateError}</AutoDismissNotice>}
    {template && <div className="game-template-assurance"><Gamepad2 size={20} /><p><strong>{template.interaction}</strong><span>{interactive ? "This mission uses a fixed, versioned game and safety rules. Customise the module cover, lessons and knowledge check in the other steps, then publish and assign normally." : "This draft contains legacy guided rounds. Keep them or replace them with the interactive mission."}</span></p></div>}
    {template && !interactive && <button type="button" className="button button-secondary" disabled={loadingTemplate} onClick={() => void changeActivityKind(definition.activityKind, true)}>Use interactive mission</button>}
    {!interactive && <><div className="repeater-list">{definition.scenarios.map((scenario, index) => <article className="authoring-repeater scenario-editor" key={scenario.id}>
      <header><div><span>{isGame ? "Round" : "Scenario"} {String(index + 1).padStart(2, "0")}</span><strong>{scenario.prompt || (isGame ? "Untitled game round" : "Untitled practical decision")}</strong></div><RepeaterActions label={`${itemName} ${index + 1}`} index={index} count={definition.scenarios.length} onMove={(direction) => update({ scenarios: moveItem(definition.scenarios, index, direction) })} onRemove={() => update({ scenarios: definition.scenarios.filter((_, itemIndex) => itemIndex !== index) })} /></header>
      <div className="authoring-form-grid"><label className="plain-field authoring-wide"><span>{isGame ? "Round situation" : "Workplace situation"}</span><textarea rows={3} value={scenario.situation} onChange={(event) => changeScenario(index, { situation: event.target.value })} placeholder="Describe the operational context without revealing the answer." /></label><label className="plain-field authoring-wide"><span>{isGame ? "Game prompt" : "Decision question"}</span><input value={scenario.prompt} onChange={(event) => changeScenario(index, { prompt: event.target.value })} placeholder={isGame ? "What should the trainee inspect, choose or place?" : "What should the trainee do first?"} /></label></div>
      <fieldset className="choice-authoring"><legend>{isGame ? "Game moves and private feedback" : "Choices and private feedback"}</legend>{scenario.choices.map((choice, choiceIndex) => <div className={choice.isCorrect ? "correct" : ""} key={choice.id}><label className="correct-choice"><input type="radio" name={`scenario-${scenario.id}-correct`} checked={choice.isCorrect} onChange={() => changeScenario(index, { choices: scenario.choices.map((item, itemIndex) => ({ ...item, isCorrect: itemIndex === choiceIndex })) })} /><span>{choice.isCorrect ? (isGame ? "Correct move" : "Safest answer") : (isGame ? "Mark correct" : "Mark safest")}</span></label><span className="choice-letter">{choice.id.toUpperCase()}</span><label><span>{isGame ? "Move shown to trainee" : "Choice shown to trainee"}</span><input value={choice.label} onChange={(event) => changeScenario(index, { choices: scenario.choices.map((item, itemIndex) => itemIndex === choiceIndex ? { ...item, label: event.target.value } : item) })} /></label><label><span>Feedback after selection</span><textarea rows={2} value={choice.feedback} onChange={(event) => changeScenario(index, { choices: scenario.choices.map((item, itemIndex) => itemIndex === choiceIndex ? { ...item, feedback: event.target.value } : item) })} /></label><button type="button" aria-label={`Remove choice ${choice.id}`} disabled={scenario.choices.length <= 2} onClick={() => changeScenario(index, { choices: scenario.choices.filter((_, itemIndex) => itemIndex !== choiceIndex) })}><Trash2 size={15} /></button></div>)}</fieldset>
      <button className="text-add-button" type="button" onClick={() => {
        const choiceId = nextLetterId(scenario.choices);
        changeScenario(index, { choices: [...scenario.choices, { id: choiceId, label: "", feedback: "", isCorrect: false }] });
      }} disabled={scenario.choices.length >= 4}><Plus size={15} /> Add {isGame ? "move" : "choice"}</button>
    </article>)}</div>
    <button className="authoring-add-card" type="button" onClick={addScenario} disabled={definition.scenarios.length >= 12}><Plus size={20} /><span><strong>Add {isGame ? "game round" : "practical scenario"}</strong><small>Situation, {isGame ? "interactive moves" : "decision choices"} and private feedback</small></span></button></>}
  </section>;
}

function AssessmentEditor({ definition, update }: { definition: ModuleAuthoringDefinition; update: (patch: Partial<ModuleAuthoringDefinition>) => void }) {
  function changeQuestion(index: number, patch: Partial<AuthoredQuestion>) {
    update({ questions: definition.questions.map((question, itemIndex) => itemIndex === index ? { ...question, ...patch } : question) });
  }
  function addQuestion() {
    update({ questions: [...definition.questions, { id: crypto.randomUUID(), questionType: "single_choice", prompt: "", explanation: "", points: 1, options: [
      { id: "a", label: "", isCorrect: true }, { id: "b", label: "", isCorrect: false }, { id: "c", label: "", isCorrect: false },
    ] }] });
  }
  return <section className="authoring-section">
    <SectionHeading eyebrow="04 / Assessment" title="Create the protected knowledge check" description="Questions and options are visible to trainees; the correct keys stay in the private scoring schema." count={`${definition.questions.length} / 20 questions`} />
    <div className="assessment-assurance"><LockKeyhole size={20} /><p><strong>Protected answer keys</strong><span>The selected correct options below are saved privately and are never included in trainee page data.</span></p></div>
    <div className="repeater-list">{definition.questions.map((question, index) => <article className="authoring-repeater question-editor" key={question.id}>
      <header><div><span>Question {String(index + 1).padStart(2, "0")}</span><strong>{question.prompt || "Untitled assessment question"}</strong></div><RepeaterActions label={`question ${index + 1}`} index={index} count={definition.questions.length} onMove={(direction) => update({ questions: moveItem(definition.questions, index, direction) })} onRemove={() => update({ questions: definition.questions.filter((_, itemIndex) => itemIndex !== index) })} /></header>
      <div className="authoring-form-grid"><label className="plain-field"><span>Question type</span><select value={question.questionType} onChange={(event) => {
        const questionType = event.target.value as AuthoredQuestion["questionType"];
        changeQuestion(index, { questionType, options: questionType === "true_false" ? [{ id: "true", label: "True", isCorrect: true }, { id: "false", label: "False", isCorrect: false }] : question.options });
      }}><option value="single_choice">Single choice</option><option value="multiple_choice">Multiple choice</option><option value="true_false">True / false</option></select></label><label className="plain-field"><span>Question points</span><input type="number" min={1} max={100} value={question.points} onChange={(event) => changeQuestion(index, { points: Number(event.target.value) })} /></label><label className="plain-field authoring-wide"><span>Question prompt</span><textarea rows={2} value={question.prompt} onChange={(event) => changeQuestion(index, { prompt: event.target.value })} /></label></div>
      <fieldset className="quiz-option-editor"><legend>Options and protected answer key</legend>{question.options.map((option, optionIndex) => <label className={option.isCorrect ? "correct" : ""} key={option.id}><input type={question.questionType === "multiple_choice" ? "checkbox" : "radio"} name={`question-${question.id}-correct`} checked={option.isCorrect} onChange={(event) => changeQuestion(index, { options: question.options.map((item, itemIndex) => ({ ...item, isCorrect: question.questionType === "multiple_choice" ? (itemIndex === optionIndex ? event.target.checked : item.isCorrect) : itemIndex === optionIndex })) })} /><span>{option.id.toUpperCase()}</span><input aria-label={`Option ${option.id} for question ${index + 1}`} value={option.label} disabled={question.questionType === "true_false"} onChange={(event) => changeQuestion(index, { options: question.options.map((item, itemIndex) => itemIndex === optionIndex ? { ...item, label: event.target.value } : item) })} />{question.questionType !== "true_false" && <button type="button" aria-label={`Remove option ${option.id}`} disabled={question.options.length <= 2} onClick={(event) => { event.preventDefault(); changeQuestion(index, { options: question.options.filter((_, itemIndex) => itemIndex !== optionIndex) }); }}><Trash2 size={14} /></button>}</label>)}</fieldset>
      {question.questionType !== "true_false" && <button className="text-add-button" type="button" onClick={() => {
        const optionId = nextLetterId(question.options);
        changeQuestion(index, { options: [...question.options, { id: optionId, label: "", isCorrect: false }] });
      }} disabled={question.options.length >= 6}><Plus size={15} /> Add option</button>}
      <label className="plain-field explanation-field"><span>Explanation shown after answering</span><textarea rows={3} value={question.explanation} onChange={(event) => changeQuestion(index, { explanation: event.target.value })} /></label>
    </article>)}</div>
    <button className="authoring-add-card" type="button" onClick={addQuestion} disabled={definition.questions.length >= 20}><Plus size={20} /><span><strong>Add assessment question</strong><small>Prompt, options, protected key and explanation</small></span></button>
  </section>;
}

function ReviewPanel({ definition, coverPreviewUrl, readiness, moduleStatus, canDelete, isPublished, busy, publishing, deleting, onPublish, onStep, onDelete }: {
  definition: ModuleAuthoringDefinition;
  coverPreviewUrl: string | null;
  readiness: ReturnType<typeof getAuthoringReadiness>;
  moduleStatus: string;
  canDelete: boolean;
  isPublished: boolean;
  busy: boolean;
  publishing: boolean;
  deleting: boolean;
  onPublish: (published: boolean) => Promise<void>;
  onStep: (step: StepId) => void;
  onDelete: () => void;
}) {
  const deletionAllowed = !isPublished && moduleStatus === "draft" && canDelete;
  const gameTemplate = getMiniGameTemplate(definition.activityKind);
  const previewSrc = coverPreviewUrl
    ?? (isCuratedModuleCoverPath(definition.heroImagePath) ? definition.heroImagePath : "/training-hazard-perception.png");
  const reviewSteps: Array<{ id: StepId; label: string; complete: boolean; detail: string }> = [
    { id: "overview", label: "Overview and objectives", complete: readiness.steps.overview, detail: `${readiness.counts.objectives} objectives` },
    { id: "learning", label: "Core learning", complete: readiness.steps.learning, detail: `${readiness.counts.learningSections} sections` },
    { id: "practice", label: gameTemplate?.name ?? "Practical decisions", complete: readiness.steps.practice, detail: `${readiness.counts.scenarios} ${gameTemplate ? "game rounds" : "scenarios"}` },
    { id: "assessment", label: "Protected assessment", complete: readiness.steps.assessment, detail: `${readiness.counts.questions} questions` },
  ];
  return <section className="authoring-section review-panel">
    <SectionHeading eyebrow="05 / Review" title="Review the trainee experience" description="Confirm the complete pathway before making this module available." />
    <div className="review-layout">
      <div className="readiness-checklist"><h3>Publication readiness</h3>{reviewSteps.map((step) => <button type="button" key={step.id} onClick={() => onStep(step.id)}><span className={step.complete ? "complete" : "incomplete"}>{step.complete ? <CheckCircle2 size={18} /> : <ShieldAlert size={18} />}</span><p><strong>{step.label}</strong><small>{step.detail}</small></p><span>{step.complete ? "Complete" : "Review"}</span></button>)}
        {!readiness.ready && <div className="readiness-blockers"><strong>Before publishing</strong><ul>{readiness.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul></div>}
      </div>
      <div className="draft-preview"><div className="preview-ribbon"><Eye size={16} /> Trainee preview</div><div className="preview-image"><Image src={previewSrc} alt="" fill sizes="520px" /></div><div className="preview-copy"><p>{definition.category}</p><h3>{definition.title}</h3><span>{definition.description}</span><dl><div><dt>Duration</dt><dd>{definition.estimatedMinutes} min</dd></div><div><dt>Difficulty</dt><dd>{definition.difficulty}</dd></div><div><dt>Pass mark</dt><dd>{definition.passMark}%</dd></div></dl><div className="preview-path"><span>{definition.learning.length} learning sections</span><span>{definition.scenarios.length} {gameTemplate ? "game rounds" : "decisions"}</span><span>{definition.questions.length} questions</span></div></div></div>
    </div>
    <div className={`publish-review-card ${readiness.ready ? "ready" : "blocked"}`}><div>{readiness.ready ? <ShieldCheck size={25} /> : <ShieldAlert size={25} />}<p><strong>{isPublished ? "This module is live" : readiness.ready ? "Ready for the trainee library" : "Publishing is safely locked"}</strong><span>{isPublished ? "Unpublish before editing the reviewed definition." : readiness.ready ? "Saving and publishing materialises only trainee-safe content; protected keys remain private." : "Finish the checklist, save the private draft and return here to publish."}</span></p></div><button className={`button ${isPublished ? "button-secondary" : "button-primary"}`} type="button" disabled={busy || (!isPublished && !readiness.ready)} onClick={() => void onPublish(!isPublished)}>{publishing ? <LoaderCircle className="spin" /> : isPublished ? <ShieldAlert size={18} /> : <ShieldCheck size={18} />}{isPublished ? "Unpublish module" : "Publish module"}</button></div>
    <div className="module-danger-zone">
      <div><Trash2 size={22} /><p><strong>Delete this private draft</strong><span>{isPublished ? "Published modules are protected. Unpublish it before deletion can be considered." : moduleStatus !== "draft" ? "Only modules that are still private drafts can be permanently deleted." : !canDelete ? "This module has assignments or learner history and must be retained." : "This permanently removes the draft and its private uploaded cover."}</span></p></div>
      <button className="button delete-module-trigger" type="button" onClick={onDelete} disabled={!deletionAllowed || busy}>{deleting ? <LoaderCircle className="spin" size={18} /> : <Trash2 size={18} />} Delete draft</button>
    </div>
  </section>;
}
