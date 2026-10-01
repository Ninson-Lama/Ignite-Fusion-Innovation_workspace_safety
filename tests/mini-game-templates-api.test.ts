import { beforeEach, describe, expect, it, vi } from "vitest";

const { getViewer, hasActiveRole, rpc } = vi.hoisted(() => ({
  getViewer: vi.fn(),
  hasActiveRole: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getViewer }));
vi.mock("@/lib/roles", () => ({ hasActiveRole }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: async () => ({ rpc }) }));

import { GET } from "@/app/api/admin/module-templates/route";
import { MINI_GAME_TEMPLATES } from "@/lib/mini-games";

describe("private mini-game template access", () => {
  beforeEach(() => {
    getViewer.mockReset();
    hasActiveRole.mockReset();
    rpc.mockReset().mockResolvedValue({ data: true, error: null });
  });

  it("does not expose template keys without an admin session", async () => {
    getViewer.mockResolvedValue(null);
    expect((await GET(new Request("http://localhost/api/admin/module-templates?kind=ppe_dress_up"))).status).toBe(401);
    getViewer.mockResolvedValue({ role: "trainee" });
    hasActiveRole.mockReturnValue(false);
    const response = await GET(new Request("http://localhost/api/admin/module-templates?kind=ppe_dress_up"));
    expect(response.status).toBe(403);
    expect(await response.json()).not.toHaveProperty("scenarios");
  });

  it("returns a versioned interactive mission only to an active administrator", async () => {
    getViewer.mockResolvedValue({ role: "admin" });
    hasActiveRole.mockReturnValue(true);
    const response = await GET(new Request("http://localhost/api/admin/module-templates?kind=sorting_zone"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const body = await response.json();
    expect(body.scenarios).toHaveLength(1);
    expect(body.scenarios[0].id).toBe("play-sorting-v1");
    expect(hasActiveRole).toHaveBeenCalledWith({ role: "admin" }, "admin");
  });

  it("does not offer an unscorable mission before database setup", async () => {
    getViewer.mockResolvedValue({ role: "admin" });
    hasActiveRole.mockReturnValue(true);
    rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    expect((await GET(new Request("http://localhost/api/admin/module-templates?kind=ppe_dress_up"))).status).toBe(503);
  });

  it("rejects unsupported template types", async () => {
    getViewer.mockResolvedValue({ role: "admin" });
    hasActiveRole.mockReturnValue(true);
    expect((await GET(new Request("http://localhost/api/admin/module-templates?kind=unknown"))).status).toBe(400);
  });

  it("keeps all private rounds and keys out of the public template metadata", () => {
    const metadata = JSON.stringify(MINI_GAME_TEMPLATES);
    expect(metadata).not.toMatch(/"(?:rounds|choices|isCorrect|feedback)"/);
  });
});
