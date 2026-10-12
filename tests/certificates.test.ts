import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildCertificateReference } from "@/lib/certificates";
import { buildCertificatePdf } from "@/lib/certificate-pdf";

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

describe("certificate PDF downloads", () => {
  it("creates a valid landscape PDF with a safe download name", async () => {
    const result = await buildCertificatePdf({
      recipientName: "Ninson Lama",
      moduleTitle: "Cyber Awareness",
      completedDate: "9 October 2026",
      certificateReference: "IFI-2026-123456781234",
    });

    expect(result.filename).toBe("ifi-safety360-cyber-awareness-certificate.pdf");
    expect(new TextDecoder().decode(result.bytes.slice(0, 5))).toBe("%PDF-");

    const document = await PDFDocument.load(result.bytes);
    expect(document.getPageCount()).toBe(1);
    const { width, height } = document.getPage(0).getSize();
    expect(width).toBeGreaterThan(height);
    expect(document.getTitle()).toContain("Cyber Awareness");
  });
});
