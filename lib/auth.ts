import { redirect } from "next/navigation";
import { cache } from "react";
import type { ViewerProfile } from "@/types";
import { getRoleMismatchDestination } from "./auth-feedback";
import { createServerSupabaseClient, getVerifiedIdentity } from "./supabase/server";
import { normaliseTrustedRole } from "./roles";

export const getViewer = cache(async (): Promise<ViewerProfile | null> => {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;

  const identity = await getVerifiedIdentity(supabase);
  if (!identity) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, employee_number, department, role, status")
    .eq("id", identity.id)
    .maybeSingle();

  if (profileError || !profile) return null;

  const status = profile.status === "active" || profile.status === "inactive" || profile.status === "suspended"
    ? profile.status
    : "inactive";

  return {
    id: identity.id,
    email: identity.email,
    fullName: profile.full_name || "Safety360 trainee",
    employeeNumber: profile.employee_number ?? null,
    department: profile.department ?? null,
    role: normaliseTrustedRole(profile.role),
    status,
  };
});

export async function requireViewer() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?message=Please%20sign%20in%20to%20continue");
  if (viewer.status !== "active") redirect("/login?message=This%20account%20is%20not%20active.%20Contact%20an%20administrator");
  return viewer;
}

export async function requireAdmin() {
  const viewer = await requireViewer();
  if (viewer.role !== "admin") redirect(getRoleMismatchDestination("admin"));
  return viewer;
}

export async function requireTrainee() {
  const viewer = await requireViewer();
  if (viewer.role !== "trainee") redirect(getRoleMismatchDestination("trainee"));
  return viewer;
}
