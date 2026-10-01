import type { Metadata } from "next";
import { LockKeyhole, ShieldCheck, UserRound } from "lucide-react";
import { ProfileForm } from "@/components/ProfileForm";
import { requireViewer } from "@/lib/auth";

export const metadata: Metadata = { title: "Profile" };
export default async function ProfilePage() {
  const viewer = await requireViewer();
  return <><header className="page-heading"><div><p className="section-kicker">Account</p><h1>Your profile</h1><p>Manage safe personal fields while role and access remain protected.</p></div></header><div className="profile-layout"><aside className="profile-summary"><span className="profile-avatar"><UserRound /></span><h2>{viewer.fullName}</h2><p>{viewer.email}</p><dl><div><dt>Role</dt><dd>{viewer.role}</dd></div><div><dt>Status</dt><dd>{viewer.status}</dd></div><div><dt>Department</dt><dd>{viewer.department || "Not provided"}</dd></div></dl><div className="profile-security"><ShieldCheck /><div><strong>Trusted access control</strong><p>Your role is read from protected application data, not browser fields.</p></div></div></aside><ProfileForm viewer={viewer} /></div><div className="security-note"><LockKeyhole /><p>Safety360 does not display or store your password. Password handling is provided by Supabase Authentication.</p></div></>;
}
