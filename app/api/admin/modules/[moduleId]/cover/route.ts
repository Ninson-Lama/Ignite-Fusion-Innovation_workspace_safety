import { NextResponse } from "next/server";
import { z } from "zod";
import { getViewer } from "@/lib/auth";
import {
  createModuleCoverObjectPath,
  detectModuleCoverFormat,
  isUploadedModuleCoverPath,
  MODULE_COVER_MAX_BYTES,
  MODULE_COVERS_BUCKET,
  signModuleCoverPath,
} from "@/lib/module-covers";
import { hasActiveRole } from "@/lib/roles";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const moduleIdSchema = z.string().uuid();
const revisionSchema = z.string().datetime({ offset: true }).nullable();
const requestOverheadAllowance = 128 * 1024;

export async function POST(request: Request, { params }: { params: Promise<{ moduleId: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "Sign in is required." }, { status: 401 });
  if (!hasActiveRole(viewer, "admin")) {
    return NextResponse.json({ error: "Active administrator access is required." }, { status: 403 });
  }

  const moduleId = moduleIdSchema.safeParse((await params).moduleId);
  if (!moduleId.success) return NextResponse.json({ error: "Training module was not found." }, { status: 404 });

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MODULE_COVER_MAX_BYTES + requestOverheadAllowance) {
    return NextResponse.json({ error: "The cover image must be no larger than 4 MB." }, { status: 413 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a JPG, PNG or WebP image from your device." }, { status: 400 });
  }
  if (!file.size || file.size > MODULE_COVER_MAX_BYTES) {
    return NextResponse.json({ error: "The cover image must be no larger than 4 MB." }, { status: 413 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const format = detectModuleCoverFormat(bytes);
  if (!format) {
    return NextResponse.json({ error: "The selected file is not a valid JPG, PNG or WebP image." }, { status: 415 });
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });
  const expectedUpdatedAt = revisionSchema.safeParse(formData?.get("expectedUpdatedAt") || null);
  if (!expectedUpdatedAt.success) {
    return NextResponse.json({ error: "Reload the module before uploading its cover image." }, { status: 409 });
  }
  const objectPath = createModuleCoverObjectPath(moduleId.data, crypto.randomUUID(), format.extension);
  const { error: uploadError } = await supabase.storage.from(MODULE_COVERS_BUCKET).upload(objectPath, bytes, {
    cacheControl: "31536000",
    contentType: format.mimeType,
    upsert: false,
  });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message || "The cover image could not be uploaded." }, { status: 400 });
  }

  const { data: saveResult, error: saveError } = await supabase.rpc("admin_set_module_cover", {
    module_id: moduleId.data,
    cover_path: objectPath,
    expected_updated_at: expectedUpdatedAt.data,
  });
  if (saveError) {
    await supabase.storage.from(MODULE_COVERS_BUCKET).remove([objectPath]);
    const status = saveError.code === "40001" || saveError.code === "23514"
      ? 409
      : saveError.code === "22023"
        ? 400
        : 403;
    return NextResponse.json({ error: saveError.message || "The uploaded cover could not be saved to the draft." }, { status });
  }

  const savePayload = saveResult && typeof saveResult === "object" ? saveResult as Record<string, unknown> : {};
  const previousPath = savePayload.previousCoverPath;
  const coverPreviewUrl = await signModuleCoverPath(supabase, objectPath);
  let cleanupPending = false;
  if (isUploadedModuleCoverPath(previousPath) && previousPath !== objectPath) {
    const { error: cleanupError } = await supabase.storage.from(MODULE_COVERS_BUCKET).remove([previousPath]);
    cleanupPending = Boolean(cleanupError);
  }

  return NextResponse.json({
    saved: true,
    heroImagePath: objectPath,
    coverPreviewUrl,
    updatedAt: typeof savePayload.updatedAt === "string" ? savePayload.updatedAt : null,
    cleanupPending,
  });
}
