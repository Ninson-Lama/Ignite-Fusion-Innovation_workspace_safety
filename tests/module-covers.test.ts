import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createModuleCoverObjectPath,
  DEFAULT_MODULE_COVER_PATH,
  detectModuleCoverFormat,
  isCuratedModuleCoverPath,
  isUploadedModuleCoverPath,
  MODULE_COVER_MAX_BYTES,
  MODULE_COVERS_BUCKET,
  moduleCoverBelongsTo,
  resolveCuratedModuleCoverPath,
  resolveModuleCoverUrl,
  signModuleCoverPath,
} from "@/lib/module-covers";

const moduleId = "8e857976-1365-49ad-ad18-8ce1f7bd1af6";
const objectId = "e1d57bdc-4721-4f8e-b439-5096b7a86f5d";
const storedPath = `${moduleId}/${objectId}.webp`;

function storageClient(result: { data: { signedUrl: string } | null; error: Error | null }) {
  const createSignedUrl = vi.fn().mockResolvedValue(result);
  const from = vi.fn().mockReturnValue({ createSignedUrl });
  return {
    client: { storage: { from } } as unknown as SupabaseClient,
    createSignedUrl,
    from,
  };
}

describe("module cover paths", () => {
  it("accepts only exact curated cover paths", () => {
    expect(isCuratedModuleCoverPath("/training-manual-handling.png")).toBe(true);
    expect(isCuratedModuleCoverPath("https://example.com/training-manual-handling.png")).toBe(false);
    expect(resolveCuratedModuleCoverPath("/unknown.png")).toBe(DEFAULT_MODULE_COVER_PATH);
  });

  it("accepts strict immutable module/object UUID keys", () => {
    expect(isUploadedModuleCoverPath(storedPath)).toBe(true);
    expect(isUploadedModuleCoverPath(`${moduleId}/${objectId}.jpeg`)).toBe(false);
    expect(isUploadedModuleCoverPath(`${moduleId}/../${objectId}.webp`)).toBe(false);
    expect(isUploadedModuleCoverPath(`https://example.com/${storedPath}`)).toBe(false);
    expect(isUploadedModuleCoverPath(storedPath.toUpperCase())).toBe(false);
  });

  it("checks that an uploaded cover is scoped to the requested module", () => {
    expect(moduleCoverBelongsTo(storedPath, moduleId)).toBe(true);
    expect(moduleCoverBelongsTo(storedPath, "00000000-0000-4000-8000-000000000001")).toBe(false);
  });

  it("generates validated immutable object keys", () => {
    expect(createModuleCoverObjectPath(moduleId, objectId, "png")).toBe(`${moduleId}/${objectId}.png`);
    expect(() => createModuleCoverObjectPath("not-a-uuid", objectId, "png")).toThrow(/valid module/i);
  });

  it("defines a four-megabyte upload ceiling", () => {
    expect(MODULE_COVER_MAX_BYTES).toBe(4_194_304);
  });
});

describe("module cover signatures", () => {
  it("recognises PNG, JPEG and WebP from their bytes", () => {
    expect(detectModuleCoverFormat(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toEqual({ extension: "png", mimeType: "image/png" });
    expect(detectModuleCoverFormat(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toEqual({ extension: "jpg", mimeType: "image/jpeg" });
    expect(detectModuleCoverFormat(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toEqual({ extension: "webp", mimeType: "image/webp" });
  });

  it("rejects declared-looking but unsupported or truncated data", () => {
    expect(detectModuleCoverFormat(new TextEncoder().encode("<svg><script /></svg>"))).toBeNull();
    expect(detectModuleCoverFormat(new Uint8Array([0x89, 0x50, 0x4e]))).toBeNull();
    expect(detectModuleCoverFormat(new ArrayBuffer(12))).toBeNull();
  });
});

describe("module cover URL resolution", () => {
  it("signs only validated uploaded keys in the private bucket", async () => {
    const { client, from, createSignedUrl } = storageClient({ data: { signedUrl: "https://storage.example/signed-cover" }, error: null });
    await expect(signModuleCoverPath(client, storedPath, 600)).resolves.toBe("https://storage.example/signed-cover");
    expect(from).toHaveBeenCalledWith(MODULE_COVERS_BUCKET);
    expect(createSignedUrl).toHaveBeenCalledWith(storedPath, 600);
  });

  it("does not call Storage for curated or malformed paths", async () => {
    const { client, from } = storageClient({ data: { signedUrl: "unused" }, error: null });
    await expect(resolveModuleCoverUrl(client, "/training-working-at-height.png")).resolves.toBe("/training-working-at-height.png");
    await expect(resolveModuleCoverUrl(client, "https://evil.example/image.png")).resolves.toBe(DEFAULT_MODULE_COVER_PATH);
    expect(from).not.toHaveBeenCalled();
  });

  it("falls back safely when signing fails", async () => {
    const { client } = storageClient({ data: null, error: new Error("not authorised") });
    await expect(resolveModuleCoverUrl(client, storedPath, "/training-cyber-awareness.png")).resolves.toBe("/training-cyber-awareness.png");
  });
});
