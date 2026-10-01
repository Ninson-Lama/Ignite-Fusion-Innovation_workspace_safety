import { NextResponse } from "next/server";
import { z } from "zod";
import { getViewer } from "@/lib/auth";
import {
  isUploadedModuleCoverPath,
  MODULE_COVERS_BUCKET,
  moduleCoverBelongsTo,
} from "@/lib/module-covers";
import { moduleAuthoringDefinitionSchema } from "@/lib/module-authoring";
import { hasActiveRole } from "@/lib/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const moduleIdSchema = z.string().uuid();
const revisionSchema = z.string().datetime({ offset: true }).nullable();
const saveModuleSchema = z.object({
  definition: moduleAuthoringDefinitionSchema,
  expectedUpdatedAt: revisionSchema,
});
const deleteModuleSchema = z.object({
  expectedSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  expectedUpdatedAt: revisionSchema,
});

function draftDefinition(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const payload = value as Record<string, unknown>;
  const parsed = moduleAuthoringDefinitionSchema.safeParse(payload.definition);
  return parsed.success ? parsed.data : null;
}

async function removeUploadedCover(
  supabase: NonNullable<Awaited<ReturnType<typeof createServerSupabaseClient>>>,
  moduleId: string,
  coverPath: unknown,
) {
  if (!isUploadedModuleCoverPath(coverPath) || !moduleCoverBelongsTo(coverPath, moduleId)) return true;
  const { error } = await supabase.storage.from(MODULE_COVERS_BUCKET).remove([coverPath]);
  return !error;
}

export async function PUT(request: Request, { params }: { params: Promise<{ moduleId: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  if (!hasActiveRole(viewer, "admin")) {
    return NextResponse.json({ error: "Active administrator access is required." }, { status: 403 });
  }

  const moduleId = moduleIdSchema.safeParse((await params).moduleId);
  const saveRequest = saveModuleSchema.safeParse(await request.json().catch(() => null));
  if (!moduleId.success || !saveRequest.success) {
    return NextResponse.json({ error: "Review the module draft and try again." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { data: currentDraft } = await supabase.rpc("admin_get_module_draft", { module_id: moduleId.data });
  const previousDefinition = draftDefinition(currentDraft);
  const { data, error } = await supabase.rpc("admin_save_module_draft", {
    module_id: moduleId.data,
    definition: saveRequest.data.definition,
    expected_updated_at: saveRequest.data.expectedUpdatedAt,
  });
  if (error) {
    const status = error.code === "23505" || error.code === "23514" || error.code === "40001"
      ? 409
      : error.code === "22023"
        ? 400
        : 403;
    return NextResponse.json({ error: error.message || "The module draft could not be saved." }, { status });
  }
  let cleanupPending = false;
  if (
    previousDefinition
    && previousDefinition.heroImagePath !== saveRequest.data.definition.heroImagePath
    && isUploadedModuleCoverPath(previousDefinition.heroImagePath)
  ) {
    cleanupPending = !(await removeUploadedCover(supabase, moduleId.data, previousDefinition.heroImagePath));
  }
  return NextResponse.json({ saved: true, result: data, cleanupPending });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ moduleId: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  if (!hasActiveRole(viewer, "admin")) {
    return NextResponse.json({ error: "Active administrator access is required." }, { status: 403 });
  }

  const moduleId = moduleIdSchema.safeParse((await params).moduleId);
  const confirmation = deleteModuleSchema.safeParse(await request.json().catch(() => null));
  if (!moduleId.success || !confirmation.success) {
    return NextResponse.json({ error: "Confirm the exact module before deleting it." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const { data, error } = await supabase.rpc("admin_delete_module", {
    module_id: moduleId.data,
    expected_slug: confirmation.data.expectedSlug,
    expected_updated_at: confirmation.data.expectedUpdatedAt,
  });
  if (error) {
    const status = error.code === "42501"
      ? 403
      : error.code === "22023" && error.message.toLowerCase().includes("not found")
        ? 404
        : error.code === "22023"
          ? 400
          : 409;
    return NextResponse.json({ error: error.message || "The module draft could not be deleted." }, { status });
  }

  const payload = data && typeof data === "object" ? data as Record<string, unknown> : {};
  const coverPath = payload.coverPath;
  const cleanupComplete = !isUploadedModuleCoverPath(coverPath)
    || await removeUploadedCover(supabase, moduleId.data, coverPath);

  return NextResponse.json({
    deleted: true,
    title: typeof payload.title === "string" ? payload.title : "Module draft",
    cleanupPending: !cleanupComplete,
  });
}
