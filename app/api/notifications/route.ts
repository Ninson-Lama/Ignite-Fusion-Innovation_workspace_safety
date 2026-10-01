import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { getAssignmentNotifications } from "@/lib/queries";
import { hasActiveRole } from "@/lib/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { notificationReadSchema } from "@/lib/validation";

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  if (!hasActiveRole(viewer, "trainee")) return NextResponse.json({ error: "Active trainee access is required." }, { status: 403 });
  return NextResponse.json({ notifications: await getAssignmentNotifications(viewer.id) });
}

export async function PATCH(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  if (!hasActiveRole(viewer, "trainee")) return NextResponse.json({ error: "Active trainee access is required." }, { status: 403 });
  const parsed = notificationReadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "The notification selection was not valid." }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { data, error } = await supabase.rpc("mark_assignment_notifications_read", {
    notification_ids: parsed.data.ids ?? null,
  });
  if (error) return NextResponse.json({ error: "Notifications could not be updated." }, { status: 400 });
  return NextResponse.json({ updated: Number(data ?? 0) });
}

