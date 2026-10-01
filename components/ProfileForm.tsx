"use client";

import { useState } from "react";
import { CheckCircle2, LoaderCircle, Save } from "lucide-react";
import { AutoDismissNotice } from "@/components/ui/AutoDismissNotice";
import type { ViewerProfile } from "@/types";

export function ProfileForm({ viewer }: { viewer: ViewerProfile }) {
  const [fullName, setFullName] = useState(viewer.fullName);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setStatus(null); setError(null);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Profile could not be updated.");
      setStatus("Profile changes saved securely.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Profile could not be updated.");
    } finally { setSaving(false); }
  }

  return (
    <form className="profile-form" onSubmit={save}>
      <div className="profile-form-heading"><div><h2>Personal details</h2><p>Keep your display information accurate. Account role and status are managed separately.</p></div></div>
      {status && <AutoDismissNotice key={status} className="form-status success" onDismiss={() => setStatus(null)}><CheckCircle2 size={18} /> {status}</AutoDismissNotice>}
      {error && <AutoDismissNotice key={error} className="form-status error" role="alert" onDismiss={() => setError(null)}>{error}</AutoDismissNotice>}
      <div className="profile-fields">
        <label className="plain-field"><span>Full name</span><input value={fullName} onChange={(event) => setFullName(event.target.value)} minLength={2} maxLength={80} required /></label>
        <label className="plain-field"><span>Work email</span><input value={viewer.email} disabled /><small>Change this securely through your account provider.</small></label>
        <label className="plain-field"><span>Employee number</span><input value={viewer.employeeNumber ?? "Not provided"} disabled /><small>Managed by an authorised administrator.</small></label>
        <label className="plain-field"><span>Department</span><input value={viewer.department ?? "Not provided"} disabled /><small>Protected because it is used for training assignment and reporting.</small></label>
      </div>
      <div className="profile-locked-row"><div><span>Application role</span><strong>{viewer.role}</strong></div><div><span>Account status</span><strong>{viewer.status}</strong></div><p>These trusted fields cannot be changed from your profile.</p></div>
      <button className="button button-primary" disabled={saving}>{saving ? <><LoaderCircle className="spin" size={18} /> Saving…</> : <><Save size={18} /> Save changes</>}</button>
    </form>
  );
}
