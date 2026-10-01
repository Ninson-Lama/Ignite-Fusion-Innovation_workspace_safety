import { NextResponse } from "next/server";
import { z } from "zod";
import { getViewer } from "@/lib/auth";
import { createStarterAuthoringDefinition } from "@/lib/server/module-authoring-starter";
import { hasActiveRole } from "@/lib/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ACTIVITY_KINDS } from "@/lib/mini-games";

const schema = z.object({
  moduleId: z.string().uuid(),
  published: z.boolean(),
});

const createSchema = z.object({
  title: z.string().trim().min(3).max(120),
  slug: z.string().trim().min(3).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().min(10).max(800),
  overview: z.string().trim().min(20).max(2000),
  category: z.string().trim().min(2).max(80),
  estimatedMinutes: z.number().int().min(5).max(240),
  difficulty: z.enum(["introductory", "intermediate", "advanced"]),
  passMark: z.number().int().min(1).max(100),
  pointsAvailable: z.number().int().min(0).max(5000),
  sortOrder: z.number().int().min(0).max(10000),
  learningObjectives: z.array(z.string().trim().min(5).max(200)).min(1).max(8),
  activityKind: z.enum(ACTIVITY_KINDS).default("decision"),
});

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  if (!hasActiveRole(viewer, "admin")) return NextResponse.json({ error: "Active administrator access is required." }, { status: 403 });

  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Review the module details and try again." }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });

  const definition = createStarterAuthoringDefinition(parsed.data);
  if (parsed.data.activityKind !== "decision") {
    const capability = await supabase.rpc("learning_games_status");
    if (!capability.data || capability.error) return NextResponse.json({ error: "Apply the interactive-learning database setup before creating a game module." }, { status: 503 });
  }
  const { data, error } = await supabase.rpc("admin_create_module_draft", { definition });

  if (error) {
    if (error.code === "23505" || /already exists/i.test(error.message)) {
      return NextResponse.json({ error: "A module with this URL slug already exists." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message || "The database could not create this module." }, { status: 403 });
  }

  const result = data as { module?: Record<string, unknown> } | null;
  if (!result?.module) return NextResponse.json({ error: "The module draft was not returned." }, { status: 500 });
  const moduleId = typeof result.module.id === "string" ? result.module.id : null;
  const { data: createdDraft } = moduleId
    ? await supabase.rpc("admin_get_module_draft", { module_id: moduleId })
    : { data: null };
  const createdDraftPayload = createdDraft && typeof createdDraft === "object"
    ? createdDraft as Record<string, unknown>
    : {};
  return NextResponse.json({
    module: result.module,
    updatedAt: typeof createdDraftPayload.updatedAt === "string" ? createdDraftPayload.updatedAt : null,
  }, { status: 201 });
}

export async function PATCH(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  if (!hasActiveRole(viewer, "admin")) return NextResponse.json({ error: "Active administrator access is required." }, { status: 403 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "The module update was not valid." }, { status: 400 });
  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { data, error } = await supabase.rpc("set_module_publication", {
    module_id: parsed.data.moduleId,
    published: parsed.data.published,
  });
  if (error) {
    const status = error.code === "23514" ? 409 : error.code === "22023" ? 404 : 403;
    return NextResponse.json({ error: error.message || "The database rejected this publication update." }, { status });
  }
  const { data: refreshedDraft } = await supabase.rpc("admin_get_module_draft", { module_id: parsed.data.moduleId });
  const refreshed = refreshedDraft && typeof refreshedDraft === "object"
    ? refreshedDraft as Record<string, unknown>
    : {};
  return NextResponse.json({ updated: true, module: data, canDelete: refreshed.canDelete === true });
}
