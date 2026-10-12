"use client";

import { useState } from "react";
import { Download, LoaderCircle, Printer } from "lucide-react";
import type { CertificatePdfData } from "@/lib/certificate-pdf";

export function PrintCertificateButton(data: CertificatePdfData) {
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState("");

  async function downloadPdf() {
    setDownloading(true);
    setMessage("");

    try {
      const { buildCertificatePdf } = await import("@/lib/certificate-pdf");
      const { bytes, filename } = await buildCertificatePdf(data);
      const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = url;
      link.download = filename;
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      setMessage("Certificate PDF downloaded.");
    } catch (error) {
      console.error("Certificate download failed", error);
      setMessage("The PDF could not be created. Please use Print instead.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="certificate-action-group">
      <button className="button button-secondary certificate-print-button" type="button" onClick={() => window.print()}>
        <Printer size={18} /> Print
      </button>
      <button className="button button-primary certificate-download-button" type="button" onClick={() => void downloadPdf()} disabled={downloading}>
        {downloading ? <LoaderCircle className="spin" size={18} /> : <Download size={18} />}
        {downloading ? "Preparing PDF…" : "Download PDF"}
      </button>
      <span className="certificate-download-status" role="status" aria-live="polite">{message}</span>
    </div>
  );
}
