import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth";
import { hasActiveRole } from "@/lib/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { normaliseAdminEvent } from "@/lib/admin-activity";
import { inferActivityKindFromScenarioIds } from "@/lib/mini-games";

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  if (!hasActiveRole(viewer, "admin")) return NextResponse.json({ error: "Administrator access is required." }, { status: 403 });
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "The activity service is unavailable." }, { status: 503 });
  const headers = { "Cache-Control": "private, no-store" };
  const result = await supabase.from("admin_activity_events")
    .select("id, category, event_type, subject_name, module_title, metadata, created_at")
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(60);
  const status = !result.error ? await supabase.rpc("admin_activity_status") : null;
  const realtimeReady = !status?.error && status?.data?.ready === true;
  if (!result.error && (result.data ?? []).length > 0) return NextResponse.json({ events: (result.data ?? []).map(normaliseAdminEvent), realtimeReady }, { headers });
  // Older installations still expose truthful training history while the additive
  // database migration is pending. Never disguise other failures as an empty feed.
  if (result.error && !["42P01", "PGRST205"].includes(result.error.code)) return NextResponse.json({ error: "Activity updates could not be loaded." }, { status: 503, headers });
  const [activity, profiles, modules] = await Promise.all([
    supabase.from("activity_log").select("id,user_id,module_id,event_type,metadata,created_at").order("created_at", { ascending: false }).limit(60),
    supabase.from("profiles").select("id,full_name"),
    supabase.from("training_modules").select("id,title,slug,content"),
  ]);
  if (activity.error || profiles.error || modules.error) return NextResponse.json({ error: "Activity updates could not be loaded." }, { status: 503, headers });
  const names = new Map((profiles.data ?? []).map((row) => [row.id, row.full_name]));
  const moduleMap = new Map((modules.data ?? []).map((row) => [row.id, row]));
  return NextResponse.json({ events: (activity.data ?? []).map((row) => {
    const moduleRecord = moduleMap.get(row.module_id);
    const activityKind = ["hazard-perception", "manual-handling", "working-at-height", "cyber-awareness"].includes(moduleRecord?.slug ?? "") ? "decision"
      : moduleRecord?.content?.activityKind ?? inferActivityKindFromScenarioIds((moduleRecord?.content?.scenarios ?? []).map((scenario: { id: string }) => scenario.id));
    return normaliseAdminEvent({ ...row, metadata: { ...row.metadata, activityKind }, subject_name: names.get(row.user_id), module_title: moduleRecord?.title });
  }), realtimeReady }, { headers });
}
