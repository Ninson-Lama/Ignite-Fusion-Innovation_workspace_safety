import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createClient, from, select, eq, maybeSingle, resolveCover } = vi.hoisted(() => ({
  createClient: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  maybeSingle: vi.fn(),
  resolveCover: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: createClient }));
vi.mock("@/lib/module-covers", () => ({ resolveModuleCoverUrl: resolveCover }));

import { getPublishedModuleMetadata } from "@/lib/queries";

describe("published training module lookup", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    const query = { select, eq, maybeSingle };
    createClient.mockResolvedValue({ from });
    from.mockReturnValue(query);
    select.mockReturnValue(query);
    eq.mockReturnValue(query);
    resolveCover.mockResolvedValue("/images/cyber-awareness.webp");
  });

  afterEach(() => vi.restoreAllMocks());

  it("does not misreport a database failure as a missing module", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    maybeSingle.mockResolvedValue({ data: null, error: { code: "08006", message: "Connection failed" } });

    await expect(getPublishedModuleMetadata("cyber-awareness")).rejects.toThrow(
      "The training module could not be loaded. Please try again.",
    );
    expect(resolveCover).not.toHaveBeenCalled();
  });

  it("returns null for a genuinely unavailable module", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(getPublishedModuleMetadata("missing-module")).resolves.toBeNull();
  });

  it("keeps publication filters and maps an available module", async () => {
    maybeSingle.mockResolvedValue({
      error: null,
      data: {
        id: "module-id", slug: "cyber-awareness", title: "Cyber Awareness",
        description: "Digital safety", category: "Cyber safety", estimated_minutes: 25,
        difficulty: "introductory", pass_mark: 75, overview: "Protect accounts",
        learning_objectives: ["Recognise suspicious requests"], content: null,
        hero_image_path: "/images/cyber-awareness.webp",
      },
    });

    await expect(getPublishedModuleMetadata("cyber-awareness")).resolves.toMatchObject({
      slug: "cyber-awareness", title: "Cyber Awareness", estimatedMinutes: 25, passMark: 75,
    });
    expect(from).toHaveBeenCalledWith("training_modules");
    expect(eq.mock.calls).toEqual([
      ["slug", "cyber-awareness"], ["status", "published"], ["is_published", true],
    ]);
  });
});
