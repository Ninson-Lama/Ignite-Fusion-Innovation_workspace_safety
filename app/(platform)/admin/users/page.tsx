import type { Metadata } from "next";
import { AdminUsersTable, type AdminUserRow } from "@/components/admin/AdminUsersTable";
import { requireAdmin } from "@/lib/auth";
import { getAdminData } from "@/lib/queries";
import { normaliseTrustedRole } from "@/lib/roles";

export const metadata: Metadata = { title: "User management" };
export default async function AdminUsersPage() {
  const viewer = await requireAdmin();
  const data = await getAdminData();
  const rows: AdminUserRow[] = data.profiles.map((profile) => {
    const progress = data.progress.filter((record) => record.user_id === profile.id);
    const assignments = data.assignments.filter((assignment) => assignment.user_id === profile.id && assignment.status !== "cancelled");
    const pathwayModuleIds = assignments.length
      ? assignments.map((assignment) => assignment.module_id)
      : data.modules.filter((module) => module.is_published && module.status === "published").map((module) => module.id);
    const completedModules = pathwayModuleIds.filter((moduleId) => progress.some((record) => record.module_id === moduleId && record.status === "completed")).length;
    const latest = progress.map((record) => record.last_activity_at).filter(Boolean).sort().reverse()[0] ?? null;
    return { id: profile.id, fullName: profile.full_name, employeeNumber: profile.employee_number, department: profile.department, role: normaliseTrustedRole(profile.role), status: profile.status, progress: pathwayModuleIds.length ? Math.round((completedModules / pathwayModuleIds.length) * 100) : 0, latestActivity: latest };
  });
  return <><header className="page-heading"><div><p className="section-kicker">People and access</p><h1>User overview</h1><p>Search trainee progress and manage the two trusted access levels: administrator and trainee.</p></div></header><AdminUsersTable initialRows={rows} currentRole={viewer.role} /></>;
}
