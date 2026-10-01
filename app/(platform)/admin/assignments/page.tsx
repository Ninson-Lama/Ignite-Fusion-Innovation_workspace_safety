import type { Metadata } from "next";
import { AssignmentForm } from "@/components/admin/AssignmentForm";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { requireAdmin } from "@/lib/auth";
import { getAdminData } from "@/lib/queries";

export const metadata: Metadata = { title: "Training assignments" };
export default async function AssignmentsPage() {
  await requireAdmin();
  const data = await getAdminData();
  const profileMap = new Map(data.profiles.map((profile) => [profile.id, profile]));
  const moduleMap = new Map(data.modules.map((module) => [module.id, module]));
  return <><header className="page-heading"><div><p className="section-kicker">Training allocation</p><h1>Assignments</h1><p>Connect published learning to the right trainee with an optional due date.</p></div></header><AssignmentForm trainees={data.profiles.filter((profile) => profile.role === "trainee" && profile.status === "active").map((profile) => ({ id: profile.id, label: `${profile.full_name}${profile.department ? ` · ${profile.department}` : ""}` }))} modules={data.modules.filter((module) => module.is_published).map((module) => ({ id: module.id, label: module.title }))} /><section className="admin-table-card assignment-table"><div className="section-heading"><div><p className="section-kicker">Current records</p><h2>Recent assignments</h2></div></div>{data.assignments.length ? <div className="responsive-table"><table><thead><tr><th>Trainee</th><th>Module</th><th>Assigned</th><th>Due</th><th>Status</th></tr></thead><tbody>{data.assignments.map((assignment) => <tr key={assignment.id}><td><strong>{profileMap.get(assignment.user_id)?.full_name || "Authorised trainee"}</strong></td><td>{moduleMap.get(assignment.module_id)?.title || "Training module"}</td><td>{new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(assignment.assigned_at))}</td><td>{assignment.due_date ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(assignment.due_date)) : "No due date"}</td><td><StatusBadge status={assignment.status} /></td></tr>)}</tbody></table></div> : <EmptyState title="No assignments" description="Create the first assignment using the form above." />}</section></>;
}
