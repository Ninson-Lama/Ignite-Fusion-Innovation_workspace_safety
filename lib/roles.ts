import type { ProfileStatus, UserRole } from "@/types";

type RoleProfile = {
  role: UserRole;
  status: ProfileStatus;
};

export function normaliseTrustedRole(value: unknown): UserRole {
  if (value === "admin" || value === "manager") return "admin";
  return "trainee";
}

export function getRoleHome(role: UserRole) {
  return role === "admin" ? "/admin" : "/dashboard";
}

export function hasActiveRole(viewer: RoleProfile | null | undefined, role: UserRole) {
  return viewer?.status === "active" && viewer.role === role;
}
