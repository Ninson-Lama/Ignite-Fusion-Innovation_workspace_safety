import { describe, expect, it } from "vitest";
import { safeModuleHeroPath } from "@/lib/runtime-training";

describe("safe module cover rendering", () => {
  it("accepts curated covers and signed private module-cover URLs", () => {
    expect(safeModuleHeroPath("/training-cyber-awareness.png")).toBe("/training-cyber-awareness.png");
    const signed = "https://rrvpnkrkrptduazncchx.supabase.co/storage/v1/object/sign/module-covers/8e857976-1365-49ad-ad18-8ce1f7bd1af6/e1d57bdc-4721-4f8e-b439-5096b7a86f5d.webp?token=short-lived";
    expect(safeModuleHeroPath(signed)).toBe(signed);
  });

  it("rejects raw object keys and lookalike remote URLs", () => {
    expect(safeModuleHeroPath("8e857976-1365-49ad-ad18-8ce1f7bd1af6/e1d57bdc-4721-4f8e-b439-5096b7a86f5d.webp")).toBe("/training-hazard-perception.png");
    expect(safeModuleHeroPath("https://evil.example/storage/v1/object/sign/module-covers/image.webp")).toBe("/training-hazard-perception.png");
    expect(safeModuleHeroPath("https://rrvpnkrkrptduazncchx.supabase.co/storage/v1/object/public/module-covers/image.webp")).toBe("/training-hazard-perception.png");
  });
});
