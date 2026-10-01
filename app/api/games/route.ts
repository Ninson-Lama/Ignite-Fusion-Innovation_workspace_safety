import { NextResponse } from "next/server";
import { z } from "zod";
import { getViewer } from "@/lib/auth";
import { hasActiveRole } from "@/lib/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { DRIVE_ACTIONS, GAME_IDS } from "@/lib/learning-games";

const context = z.object({ gameId: z.enum(GAME_IDS), moduleId: z.string().uuid().nullable().default(null) });
const submission = context.extend({ revision: z.number().int().min(0).max(1000000), finish: z.boolean(), state: z.object({ moves: z.array(z.enum(DRIVE_ACTIONS)).max(300), placements: z.record(z.string().max(40), z.string().max(40)).refine((value) => Object.keys(value).length <= 32) }).strict() });
const headers = { "Cache-Control": "private, no-store" };
async function client() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in is required." }, { status: 401, headers });
  if (!hasActiveRole(viewer, "trainee")) return NextResponse.json({ error: "Active trainee access is required." }, { status: 403, headers });
  return await createServerSupabaseClient() ?? NextResponse.json({ error: "Game service is unavailable." }, { status: 503, headers });
}
function failure(error: { code?: string; message: string }) {
  const missing = ["PGRST202", "42P01", "42883"].includes(error.code ?? "");
  return NextResponse.json({ error: missing ? "Mini-game saving is not enabled yet. Ask your administrator to complete the mini-game database setup." : error.code === "40001" ? "Progress changed in another tab. Reload your saved game." : "The game could not be saved or loaded. Check the module is still published, then retry." }, { status: missing ? 503 : error.code === "40001" ? 409 : 400, headers });
}
export async function GET(request: Request) {
  const supabase = await client(); if (supabase instanceof NextResponse) return supabase;
  const url = new URL(request.url);
  const parsed = context.safeParse({ gameId: url.searchParams.get("gameId"), moduleId: url.searchParams.get("moduleId") });
  if (!parsed.success) return NextResponse.json({ error: "Invalid game." }, { status: 400, headers });
  const { data, error } = await supabase.rpc("learning_game_session", { game_id: parsed.data.gameId, module_id: parsed.data.moduleId });
  if (error) return failure(error);
  return NextResponse.json({ run: data }, { headers });
}
export async function POST(request: Request) {
  const supabase = await client(); if (supabase instanceof NextResponse) return supabase;
  const raw = await request.text();
  if (raw.length > 16000) return NextResponse.json({ error: "Game payload too large." }, { status: 413, headers });
  let body: unknown; try { body = JSON.parse(raw); } catch { body = null; }
  const parsed = submission.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid game state." }, { status: 400, headers });
  const { data, error } = await supabase.rpc("save_learning_game", { game_id: parsed.data.gameId, module_id: parsed.data.moduleId, game_state: parsed.data.state, expected_revision: parsed.data.revision, finish: parsed.data.finish });
  if (error) return failure(error);
  return NextResponse.json({ run: data }, { headers });
}
