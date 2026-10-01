import type { SupabaseClient } from "@supabase/supabase-js";

export const MODULE_COVERS_BUCKET = "module-covers";
export const MODULE_COVER_MAX_BYTES = 4 * 1024 * 1024;
export const MODULE_COVER_SIGNED_URL_TTL_SECONDS = 15 * 60;

export const MODULE_COVER_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const CURATED_MODULE_COVER_PATHS = [
  "/training-hazard-perception.png",
  "/training-manual-handling.png",
  "/training-working-at-height.png",
  "/training-cyber-awareness.png",
] as const;

export const DEFAULT_MODULE_COVER_PATH = CURATED_MODULE_COVER_PATHS[0];

export type ModuleCoverFormat = {
  extension: "jpg" | "png" | "webp";
  mimeType: (typeof MODULE_COVER_ALLOWED_MIME_TYPES)[number];
};

const uuidPattern = "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const uploadedModuleCoverPattern = new RegExp(`^(${uuidPattern})/(${uuidPattern})\\.(jpg|png|webp)$`);

export function isCuratedModuleCoverPath(value: unknown): value is (typeof CURATED_MODULE_COVER_PATHS)[number] {
  return typeof value === "string"
    && CURATED_MODULE_COVER_PATHS.some((path) => path === value);
}

export function resolveCuratedModuleCoverPath(
  value: unknown,
  fallback: (typeof CURATED_MODULE_COVER_PATHS)[number] = DEFAULT_MODULE_COVER_PATH,
) {
  return isCuratedModuleCoverPath(value) ? value : fallback;
}

export function isUploadedModuleCoverPath(value: unknown): value is string {
  return typeof value === "string" && uploadedModuleCoverPattern.test(value);
}

export function moduleCoverBelongsTo(value: unknown, moduleId: string) {
  if (!isUploadedModuleCoverPath(value)) return false;
  const match = uploadedModuleCoverPattern.exec(value);
  return match?.[1] === moduleId.toLowerCase();
}

function bytesFrom(input: ArrayBuffer | Uint8Array) {
  return input instanceof Uint8Array ? input : new Uint8Array(input);
}

function matches(bytes: Uint8Array, offset: number, signature: readonly number[]) {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

export function detectModuleCoverFormat(input: ArrayBuffer | Uint8Array): ModuleCoverFormat | null {
  const bytes = bytesFrom(input);

  if (bytes.length >= 8 && matches(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { extension: "png", mimeType: "image/png" };
  }

  if (bytes.length >= 3 && matches(bytes, 0, [0xff, 0xd8, 0xff])) {
    return { extension: "jpg", mimeType: "image/jpeg" };
  }

  if (
    bytes.length >= 12
    && matches(bytes, 0, [0x52, 0x49, 0x46, 0x46])
    && matches(bytes, 8, [0x57, 0x45, 0x42, 0x50])
  ) {
    return { extension: "webp", mimeType: "image/webp" };
  }

  return null;
}

export function createModuleCoverObjectPath(moduleId: string, objectId: string, extension: ModuleCoverFormat["extension"]) {
  const value = `${moduleId.toLowerCase()}/${objectId.toLowerCase()}.${extension}`;
  if (!isUploadedModuleCoverPath(value)) throw new Error("A valid module and object UUID are required.");
  return value;
}

export async function signModuleCoverPath(
  supabase: SupabaseClient,
  storedPath: unknown,
  expiresIn = MODULE_COVER_SIGNED_URL_TTL_SECONDS,
) {
  if (!isUploadedModuleCoverPath(storedPath)) return null;
  const { data, error } = await supabase.storage
    .from(MODULE_COVERS_BUCKET)
    .createSignedUrl(storedPath, expiresIn);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function resolveModuleCoverUrl(
  supabase: SupabaseClient,
  storedPath: unknown,
  fallback: (typeof CURATED_MODULE_COVER_PATHS)[number] = DEFAULT_MODULE_COVER_PATH,
  expiresIn = MODULE_COVER_SIGNED_URL_TTL_SECONDS,
) {
  if (isCuratedModuleCoverPath(storedPath)) return storedPath;
  return await signModuleCoverPath(supabase, storedPath, expiresIn) ?? fallback;
}
