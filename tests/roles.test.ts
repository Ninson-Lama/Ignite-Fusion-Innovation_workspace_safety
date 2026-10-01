import { describe, expect, it } from "vitest";
import { getRoleHome, hasActiveRole, normaliseTrustedRole } from "@/lib/roles";

describe("trusted role normalisation", () => {
  it("preserves the two application roles", () => {
    expect(normaliseTrustedRole("trainee")).toBe("trainee");
    expect(normaliseTrustedRole("admin")).toBe("admin");
  });

  it("maps legacy manager records into the admin workspace", () => {
    expect(normaliseTrustedRole("manager")).toBe("admin");
  });

  it("fails closed to trainee for unknown or missing data", () => {
    expect(normaliseTrustedRole("owner")).toBe("trainee");
    expect(normaliseTrustedRole(undefined)).toBe("trainee");
  });

  it("gives each role a separate home route", () => {
    expect(getRoleHome("admin")).toBe("/admin");
    expect(getRoleHome("trainee")).toBe("/dashboard");
  });

  it("requires both an active account and the exact requested role", () => {
    expect(hasActiveRole({ role: "admin", status: "active" }, "admin")).toBe(true);
    expect(hasActiveRole({ role: "admin", status: "active" }, "trainee")).toBe(false);
    expect(hasActiveRole({ role: "trainee", status: "suspended" }, "trainee")).toBe(false);
  });
});
