import { describe, expect, it } from "vitest";
import { buildCertificateReference } from "@/lib/certificates";

describe("certificate references", () => {
  it("creates a stable, non-email certificate reference", () => {
    const reference = buildCertificateReference(
      "12345678-1234-4000-8000-123456789abc",
      "2026-08-30T12:00:00.000Z",
    );
    expect(reference).toBe("IFI-2026-123456781234");
    expect(reference).not.toContain("@");
  });
});
