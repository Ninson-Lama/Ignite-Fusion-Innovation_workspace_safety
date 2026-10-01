import { describe, expect, it } from "vitest";
import { isBuiltInModuleSlug, slugifyModuleTitle } from "@/lib/module-catalogue";

describe("module catalogue helpers", () => {
  it("normalises an administrator title into a safe database slug", () => {
    expect(slugifyModuleTitle("  Lockout & Tagout: Essentials  ")).toBe("lockout-tagout-essentials");
  });

  it("recognises only modules with complete built-in training experiences", () => {
    expect(isBuiltInModuleSlug("cyber-awareness")).toBe(true);
    expect(isBuiltInModuleSlug("new-admin-draft")).toBe(false);
  });
});
