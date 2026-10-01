"use client";
  
import { useState } from "react";
import { CalendarPlus, CheckCircle2, LoaderCircle } from "lucide-react";

interface Option { id: string; label: string; }
export function AssignmentForm({ trainees, modules }: { trainees: Option[]; modules: Option[] }) {
  const [userId, setUserId] = useState(trainees[0]?.id ?? "");
  const [moduleId, setModuleId] = useState(modules[0]?.id ?? "");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setMessage(null);
    try {
      const response = await fetch("/api/admin/assignments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, moduleId, dueDate: dueDate || null }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Assignment could not be created.");
      setMessage("Training assigned successfully. Refresh to view the new record.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Assignment could not be created."); }
    finally { setSaving(false); }
  }

  return <form className="assignment-form" onSubmit={submit}><div><p className="section-kicker">New assignment</p><h2>Assign training</h2><p>Select a trainee, module and optional due date. Access is enforced by database policy.</p></div><label className="plain-field"><span>Trainee</span><select value={userId} onChange={(event) => setUserId(event.target.value)} required>{trainees.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="plain-field"><span>Module</span><select value={moduleId} onChange={(event) => setModuleId(event.target.value)} required>{modules.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label className="plain-field"><span>Due date</span><input type="date" min={today} value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label><button className="button button-primary" disabled={saving || !userId || !moduleId}>{saving ? <LoaderCircle className="spin" /> : <CalendarPlus />} Assign module</button>{message && <div className="form-status success" role="status"><CheckCircle2 size={18} />{message}</div>}</form>;
}
