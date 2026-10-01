import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { hasActiveRole } from "@/lib/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { trainingCheckpointSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  if (!hasActiveRole(viewer, "trainee")) return NextResponse.json({ error: "Active trainee access is required." }, { status: 403 });

  const parsed = trainingCheckpointSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "The training checkpoint was not valid." }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { data, error } = await supabase.rpc("save_training_checkpoint", {
    module_id: parsed.data.moduleId,
    stage: parsed.data.stage,
    checkpoint_position: parsed.data.position,
  });
  if (error) return NextResponse.json({ error: error.message || "Training progress could not be saved." }, { status: 400 });
  return NextResponse.json({ saved: true, progress: data });
}
