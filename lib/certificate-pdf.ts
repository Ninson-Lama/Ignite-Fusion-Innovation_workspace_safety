import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export type CertificatePdfData = {
  recipientName: string;
  moduleTitle: string;
  completedDate: string;
  certificateReference: string;
};

const PAGE_WIDTH = 841.89;
const PAGE_HEIGHT = 595.28;

function pdfSafeText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

function fileSafeText(value: string) {
  const name = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return name || "training";
}

function drawCentered(page: PDFPage, text: string, y: number, font: PDFFont, preferredSize: number, maxWidth: number, color = rgb(0.08, 0.1, 0.08)) {
  let size = preferredSize;
  while (size > 16 && font.widthOfTextAtSize(text, size) > maxWidth) size -= 1;
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: (PAGE_WIDTH - width) / 2, y, size, font, color });
}

export async function buildCertificatePdf(data: CertificatePdfData) {
  const pdfDocument = await PDFDocument.create();
  const page = pdfDocument.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const sans = await pdfDocument.embedFont(StandardFonts.Helvetica);
  const sansBold = await pdfDocument.embedFont(StandardFonts.HelveticaBold);
  const serif = await pdfDocument.embedFont(StandardFonts.TimesRomanBold);

  const ink = rgb(0.08, 0.1, 0.08);
  const green = rgb(0.21, 0.27, 0.21);
  const muted = rgb(0.4, 0.44, 0.39);
  const sage = rgb(0.81, 0.85, 0.73);
  const paper = rgb(0.98, 0.985, 0.97);
  const recipient = pdfSafeText(data.recipientName);
  const course = pdfSafeText(data.moduleTitle);
  const reference = pdfSafeText(data.certificateReference);

  pdfDocument.setTitle(`IFI Safety360 certificate - ${course}`);
  pdfDocument.setAuthor("IFI Safety360");
  pdfDocument.setSubject(`Certificate of completion for ${recipient}`);
  pdfDocument.setKeywords(["IFI", "Safety360", "training", "certificate"]);

  page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: sage });
  page.drawRectangle({ x: 24, y: 24, width: PAGE_WIDTH - 48, height: PAGE_HEIGHT - 48, color: paper, borderColor: green, borderWidth: 1.2 });
  page.drawRectangle({ x: 42, y: 42, width: PAGE_WIDTH - 84, height: PAGE_HEIGHT - 84, borderColor: sage, borderWidth: 1 });

  page.drawCircle({ x: 84, y: PAGE_HEIGHT - 82, size: 27, color: green });
  page.drawText("IFI", { x: 66, y: PAGE_HEIGHT - 89, size: 18, font: sansBold, color: paper });
  page.drawText("SAFETY360", { x: 122, y: PAGE_HEIGHT - 75, size: 15, font: sansBold, color: ink });
  page.drawText("INTERACTIVE SAFETY TRAINING", { x: 122, y: PAGE_HEIGHT - 92, size: 7.5, font: sans, color: muted });
  page.drawText("CERTIFICATE OF COMPLETION", { x: PAGE_WIDTH - 267, y: PAGE_HEIGHT - 82, size: 10, font: sansBold, color: green });
  page.drawLine({ start: { x: 66, y: PAGE_HEIGHT - 119 }, end: { x: PAGE_WIDTH - 66, y: PAGE_HEIGHT - 119 }, thickness: 0.8, color: sage });

  drawCentered(page, "This internal record confirms that", 380, sans, 15, 650, muted);
  drawCentered(page, recipient, 302, serif, 56, 690, green);
  drawCentered(page, "completed the IFI Safety360 learning pathway", 263, sans, 14, 650, muted);
  drawCentered(page, course, 207, sansBold, 29, 680, ink);
  drawCentered(page, `on ${pdfSafeText(data.completedDate)}`, 171, sansBold, 12, 650, green);

  page.drawLine({ start: { x: 66, y: 117 }, end: { x: PAGE_WIDTH - 66, y: 117 }, thickness: 0.8, color: sage });
  page.drawText("CERTIFICATE REFERENCE", { x: 66, y: 91, size: 7, font: sansBold, color: muted });
  page.drawText(reference, { x: 66, y: 74, size: 9, font: sansBold, color: green });
  const verified = "VERIFIED SAFETY360 COMPLETION";
  page.drawText(verified, { x: PAGE_WIDTH - 66 - sansBold.widthOfTextAtSize(verified, 8), y: 77, size: 8, font: sansBold, color: green });
  const note = "Internal record of completion. Not an externally accredited qualification or proof of occupational competence.";
  page.drawText(note, { x: (PAGE_WIDTH - sans.widthOfTextAtSize(note, 7)) / 2, y: 50, size: 7, font: sans, color: muted });

  return {
    bytes: await pdfDocument.save(),
    filename: `ifi-safety360-${fileSafeText(data.moduleTitle)}-certificate.pdf`,
  };
}
