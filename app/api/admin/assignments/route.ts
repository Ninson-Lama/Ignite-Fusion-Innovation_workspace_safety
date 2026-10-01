import { NextResponse } from "next/server";
import { z } from "zod";
import { getViewer } from "@/lib/auth";
import { hasActiveRole } from "@/lib/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const schema = z.object({
  userId: z.string().uuid(),
  moduleId: z.string().uuid(),
  dueDate: z.string().date().nullable(),
}).refine((value) => !value.dueDate || value.dueDate >= new Date().toISOString().slice(0, 10), {
  path: ["dueDate"],
  message: "Due date cannot be in the past.",
});
export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  if (!hasActiveRole(viewer, "admin")) return NextResponse.json({ error: "Active administrator access is required." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "The training assignment was not valid." }, { status: 400 });
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const [{ data: target }, { data: module }] = await Promise.all([
    supabase.from("profiles").select("id, role, status").eq("id", parsed.data.userId).maybeSingle(),
    supabase.from("training_modules").select("id").eq("id", parsed.data.moduleId).eq("status", "published").eq("is_published", true).maybeSingle(),
  ]);
  if (!target || target.role !== "trainee" || target.status !== "active") {
    return NextResponse.json({ error: "Training can be assigned only to an active trainee in your authorised scope." }, { status: 400 });
  }
  if (!module) return NextResponse.json({ error: "Only a published training module can be assigned." }, { status: 400 });
  const { error } = await supabase.from("module_assignments").upsert({
    user_id: parsed.data.userId, module_id: parsed.data.moduleId, assigned_by: viewer.id,
    due_date: parsed.data.dueDate, status: "assigned", assigned_at: new Date().toISOString(),
    notification_sent_at: new Date().toISOString(), notification_read_at: null,
  }, { onConflict: "user_id,module_id" });
  if (error) return NextResponse.json({ error: "The database rejected this assignment." }, { status: 403 });
  return NextResponse.json({ assigned: true });
}
