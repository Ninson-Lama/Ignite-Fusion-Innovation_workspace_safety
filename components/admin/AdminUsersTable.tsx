"use client";

import { useMemo, useState } from "react";
import { Filter, Search, ShieldCheck } from "lucide-react";
import type { ProfileStatus, UserRole } from "@/types";
import { AutoDismissNotice } from "@/components/ui/AutoDismissNotice";
import { StatusBadge } from "@/components/ui/StatusBadge";

export interface AdminUserRow {
  id: string;
  fullName: string;
  employeeNumber: string | null;
  department: string | null;
  role: UserRole;
  status: ProfileStatus;
  progress: number;
  latestActivity: string | null;
}

export function AdminUsersTable({ initialRows, currentRole }: { initialRows: AdminUserRow[]; currentRole: UserRole }) {
  const [rows, setRows] = useState(initialRows);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [progressFilter, setProgressFilter] = useState("all");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const filtered = useMemo(() => rows.filter((row) => {
    const haystack = `${row.fullName} ${row.employeeNumber ?? ""} ${row.department ?? ""}`.toLowerCase();
    const progressMatch = progressFilter === "all"
      || (progressFilter === "complete" ? row.progress === 100
        : progressFilter === "started" ? row.progress > 0 && row.progress < 100
          : row.progress === 0);
    return haystack.includes(query.toLowerCase())
      && (roleFilter === "all" || row.role === roleFilter)
      && (statusFilter === "all" || row.status === statusFilter)
      && progressMatch;
  }), [progressFilter, query, roleFilter, rows, statusFilter]);

  async function updateAccess(userId: string, role: UserRole, status: ProfileStatus) {
    setSavingId(userId);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role, status }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Access details could not be updated.");
      setRows((items) => items.map((row) => row.id === userId ? { ...row, role, status } : row));
      setMessage("Trusted role and account status updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Access details could not be updated.");
    } finally {
      setSavingId(null);
    }
  }

  return <section className="admin-table-card">
    <div className="admin-filters">
      <label><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, number or department" aria-label="Search users" /></label>
      <div><Filter size={17} />
        <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} aria-label="Filter by role"><option value="all">All roles</option><option value="trainee">Trainees</option><option value="admin">Admins</option></select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by status"><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option></select>
        <select value={progressFilter} onChange={(event) => setProgressFilter(event.target.value)} aria-label="Filter by progress"><option value="all">All progress</option><option value="not-started">Not started</option><option value="started">In progress</option><option value="complete">Complete</option></select>
      </div>
    </div>
    {message && <AutoDismissNotice key={message} className="table-message" onDismiss={() => setMessage(null)}><ShieldCheck size={17} />{message}</AutoDismissNotice>}
    <div className="responsive-table">
      <table>
        <thead><tr><th>Name</th><th>Employee</th><th>Department</th><th>Role</th><th>Status</th><th>Progress</th><th>Latest activity</th></tr></thead>
        <tbody>{filtered.map((row) => <tr key={row.id}>
          <td><strong>{row.fullName}</strong></td><td>{row.employeeNumber || "—"}</td><td>{row.department || "—"}</td>
          <td>{currentRole === "admin" ? <select className="table-select" value={row.role} onChange={(event) => void updateAccess(row.id, event.target.value as UserRole, row.status)} disabled={savingId === row.id} aria-label={`Role for ${row.fullName}`}><option value="trainee">Trainee</option><option value="admin">Admin</option></select> : <StatusBadge status={row.role} />}</td>
          <td>{currentRole === "admin" ? <select className="table-select" value={row.status} onChange={(event) => void updateAccess(row.id, row.role, event.target.value as ProfileStatus)} disabled={savingId === row.id} aria-label={`Status for ${row.fullName}`}><option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option></select> : <StatusBadge status={row.status} />}</td>
          <td><span className="table-progress"><i style={{ width: `${row.progress}%` }} /><strong>{row.progress}%</strong></span></td>
          <td>{row.latestActivity ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(row.latestActivity)) : "No activity"}</td>
        </tr>)}</tbody>
      </table>
      {!filtered.length && <div className="table-empty">No users match the current filters.</div>}
    </div>
  </section>;
}
