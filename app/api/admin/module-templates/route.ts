import { NextResponse } from "next/server";
import { z } from "zod";
import { getViewer } from "@/lib/auth";
import { hasActiveRole } from "@/lib/roles";
import { ACTIVITY_KINDS, isMiniGameActivityKind } from "@/lib/mini-games";
import { createInteractiveGameScenario } from "@/lib/server/mini-game-seeds";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  if (!hasActiveRole(viewer, "admin")) {
    return NextResponse.json({ error: "Active administrator access is required." }, { status: 403 });
  }
  const kind = z.enum(ACTIVITY_KINDS).safeParse(new URL(request.url).searchParams.get("kind"));
  if (!kind.success || !isMiniGameActivityKind(kind.data)) {
    return NextResponse.json({ error: "Choose a supported game template." }, { status: 400 });
  }
  const supabase = await createServerSupabaseClient();
  const capability = supabase ? await supabase.rpc("learning_games_status") : null;
  if (!capability?.data || capability.error) return NextResponse.json({ error: "Apply the interactive-learning database setup before using this game template." }, { status: 503 });
  return NextResponse.json({ scenarios: createInteractiveGameScenario(kind.data) }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
