import { NextResponse } from "next/server";
import { z } from "zod";
import { getViewer } from "@/lib/auth";
import { hasActiveRole } from "@/lib/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const schema = z.object({ userId: z.string().uuid(), role: z.enum(["trainee", "admin"]), status: z.enum(["active", "inactive", "suspended"]) });

export async function PATCH(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  if (!hasActiveRole(viewer, "admin")) return NextResponse.json({ error: "Active administrator access is required." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "The role update was not valid." }, { status: 400 });
  if (parsed.data.userId === viewer.id && parsed.data.role !== "admin") return NextResponse.json({ error: "Administrators cannot remove their own admin role." }, { status: 400 });
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { error } = await supabase.rpc("admin_update_profile", {
    target_user_id: parsed.data.userId,
    new_role: parsed.data.role,
    new_status: parsed.data.status,
  });
  if (error) return NextResponse.json({ error: "The database rejected this role update." }, { status: 403 });
  return NextResponse.json({ updated: true });
}
