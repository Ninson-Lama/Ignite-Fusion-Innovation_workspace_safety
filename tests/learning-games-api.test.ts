import { beforeEach, describe, expect, it, vi } from "vitest";

const { getViewer, hasActiveRole, rpc } = vi.hoisted(() => ({ getViewer: vi.fn(), hasActiveRole: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getViewer }));
vi.mock("@/lib/roles", () => ({ hasActiveRole }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: async () => ({ rpc }) }));
import { GET, POST } from "@/app/api/games/route";

const input = { gameId: "ppe", moduleId: null, state: { moves: [], placements: { "walk:boots": "equipped" } }, revision: 2, finish: false };
function request(body: unknown = input) { return new Request("http://localhost/api/games", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); }

describe("saved learning game API", () => {
  beforeEach(() => {
    getViewer.mockReset().mockResolvedValue({ role: "trainee" });
    hasActiveRole.mockReset().mockReturnValue(true);
    rpc.mockReset().mockResolvedValue({ data: null, error: null });
  });

  it("requires a session for reads and writes", async () => {
    getViewer.mockResolvedValue(null);
    expect((await GET(new Request("http://localhost/api/games?gameId=ppe"))).status).toBe(401);
    expect((await POST(request())).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects inactive or non-trainee roles before accessing storage", async () => {
    hasActiveRole.mockReturnValue(false);
    expect((await GET(new Request("http://localhost/api/games?gameId=ppe"))).status).toBe(403);
    expect((await POST(request())).status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("restores only the requested validated context without caching", async () => {
    const run = { state: input.state, revision: 2, completed: false, score: null };
    rpc.mockResolvedValue({ data: run, error: null });
    const response = await GET(new Request("http://localhost/api/games?gameId=ppe"));
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ run });
    expect(rpc).toHaveBeenCalledWith("learning_game_session", { game_id: "ppe", module_id: null });
  });

  it("rejects unknown games and malformed module identifiers", async () => {
    expect((await GET(new Request("http://localhost/api/games?gameId=unknown"))).status).toBe(400);
    expect((await GET(new Request("http://localhost/api/games?gameId=ppe&moduleId=invalid"))).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("forwards evidence and revision, never a claimed score or user ID", async () => {
    await POST(request({ ...input, score: 100, userId: "someone-else" }));
    expect(rpc).toHaveBeenCalledWith("save_learning_game", { game_id: "ppe", module_id: null, game_state: input.state, expected_revision: 2, finish: false });
  });

  it("reports revision conflicts instead of claiming to save", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "40001", message: "Conflict" } });
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(await response.json()).not.toHaveProperty("run");
  });

  it("explains missing database setup", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "Missing function" } });
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain("database setup");
  });

  it("rejects malformed JSON and invalid evidence", async () => {
    expect((await POST(new Request("http://localhost/api/games", { method: "POST", body: "{" }))).status).toBe(400);
    expect((await POST(request({ ...input, revision: -1 }))).status).toBe(400);
    expect((await POST(request({ ...input, state: { moves: ["teleport"], placements: {} } }))).status).toBe(400);
    expect((await POST(request({ ...input, state: { moves: Array(301).fill("up"), placements: {} } }))).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects oversized payloads", async () => {
    expect((await POST(request({ padding: "x".repeat(16001) }))).status).toBe(413);
    expect(rpc).not.toHaveBeenCalled();
  });
});
