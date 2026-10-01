"use client";

import { Printer } from "lucide-react";

export function PrintCertificateButton() {
  return <button className="button button-primary certificate-print-button" type="button" onClick={() => window.print()}><Printer size={18} /> Print or save as PDF</button>;
}
