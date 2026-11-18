import { jobChargeTotals } from "../gestor/jobCharges";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import interUrl from "@fontsource/inter/files/inter-latin-400-normal.woff?url";
import type { Order } from "./models";
import type { JobWorkflow } from "../gestor/jobWorkflow";
import { pipeline, workflowPayment } from "../gestor/jobWorkflow";
import { centsToAmount, sanitizeFileName, toCents } from "./finance";

export type PublicStudio = {
  studioName?: string;
  address?: string;
  phone?: string;
  email?: string;
  publicFooter?: string;
};
type PublicDocument = Order & {
  workflow?: JobWorkflow;
  currency?: "USD" | "BRL";
  scope?: string;
  constraints?: string;
  serviceType?: string;
};
const amount = (value: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
const usDate = (value?: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? "");
  return m ? `${m[2]}/${m[3]}/${m[1]}` : (value ?? "");
};
const stageNameEn: Record<string, string> = {
  lead: "Lead",
  evaluation: "Evaluation",
  quote: "Estimate sent",
  approved: "Approved",
  scheduled: "Scheduled",
  production: "In progress",
  quality: "Quality check",
  delivered: "Delivered / Paid",
  aftercare: "Aftercare",
};
/** Deliberately excludes privateNote and internal inspection annotations. No line truncation. */
export function invoicePdfLines(order: PublicDocument, studio?: PublicStudio) {
  const currency = order.currency ?? "USD";
  const charges = jobChargeTotals(order);
  const pending = charges.pending;
  const type = order.documentType === "Invoice" ? "INVOICE" : "ESTIMATE";
  return [
    `${type} · ${order.id}`,
    ...(studio?.studioName ? [`Studio: ${studio.studioName}`] : []),
    ...(studio?.address ? [`Address: ${studio.address}`] : []),
    ...([studio?.phone, studio?.email].filter(Boolean).length
      ? [
          `Studio contact: ${[studio?.phone, studio?.email].filter(Boolean).join(" · ")}`,
        ]
      : []),
    `Customer: ${order.clientSnapshot?.name || order.clientName}`,
    ...(order.clientSnapshot?.company
      ? [`Company: ${order.clientSnapshot.company}`]
      : []),
    ...(order.clientSnapshot?.email
      ? [`Contact: ${order.clientSnapshot.email}`]
      : []),
    `Issued: ${usDate(order.startDate || order.createdAt.slice(0, 10))} · Due: ${order.dueDate ? usDate(order.dueDate) : "To be defined"}`,
    `Status: ${order.workflow ? (stageNameEn[order.workflow.stage] ?? order.workflow.stage) : order.status} · Currency: ${currency}`,
    ...(order.workflow?.packageCode
      ? [`Package: ${order.workflow.packageCode} (individual services below)`]
      : []),
    "",
    "ITEMS AND SERVICES",
    ...order.lines.flatMap((line, index) => [
      `${index + 1}. ${line.serviceCode ? line.serviceCode + " · " : ""}${line.label}`,
      line.description || "Scope described below.",
      line.pricePending
        ? "Price: by evaluation, not yet quoted."
        : `${line.quantity} ${line.unit ?? "units"} × ${amount(centsToAmount(line.unitPriceCents ?? toCents(line.unitPrice)), currency)}`,
    ]),
    "",
    pending
      ? "Subtotal: to be defined by evaluation"
      : `Subtotal: ${amount(centsToAmount(charges.subtotalCents), currency)}`,
    pending
      ? "Taxes: to be defined"
      : `Taxes: ${amount(centsToAmount(charges.taxCents), currency)}`,
    ...(order.workflow && charges.adjustmentCents
      ? [
          `Explicit adjustment to the quote: ${amount(centsToAmount(charges.adjustmentCents), currency)}, included in the total charged.`,
        ]
      : []),
    pending
      ? "Total: to be defined by evaluation"
      : `Total: ${amount(centsToAmount(charges.totalCents), currency)}`,
    "",
    ...(order.workflow
      ? [
          "JOB FINANCIALS",
          `Quoted amount: ${order.workflow.quotedAmount === null ? "To be defined by evaluation" : amount(order.workflow.quotedAmount, currency)}`,
          `Final amount charged: ${order.workflow.finalAmount === null ? "Not yet defined" : amount(order.workflow.finalAmount, currency)}`,
          `Balance: ${workflowPayment(order.workflow, order.payments ?? []).balance === null ? "To be defined" : amount(workflowPayment(order.workflow, order.payments ?? []).balance!, currency)}`,
          "",
        ]
      : []),
    "PAYMENTS",
    ...(order.payments?.length
      ? order.payments.map(
          p =>
            `${usDate(p.date)} · ${p.method} · ${amount(centsToAmount(p.amountCents ?? toCents(p.amount)), currency)}`
        )
      : ["No payments recorded."]),
    ...(order.scope ? ["", "SCOPE", order.scope] : []),
    ...(order.constraints
      ? ["", "ASSUMPTIONS AND LIMITS", order.constraints]
      : []),
    "",
    "NOTE",
    order.publicNote || "No additional notes.",
    "",
    studio?.publicFooter || "Restore. Refine. Recreate.",
    "Execution depends on the evaluation, the approved scope and the delivery checks. This document does not replace validation of critical components.",
  ];
}
export function wrapText(text: string, font: PDFFont, size: number, width: number) {
  const result: string[] = [];
  for (const paragraph of text.replace(/\r/g, "").split("\n")) {
    let current = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (
        font.widthOfTextAtSize(
          [current, word].filter(Boolean).join(" "),
          size
        ) <= width
      ) {
        current = [current, word].filter(Boolean).join(" ");
        continue;
      }
      if (current) {
        result.push(current);
        current = "";
      }
      if (font.widthOfTextAtSize(word, size) > width) {
        for (const char of word) {
          if (font.widthOfTextAtSize(current + char, size) > width) {
            result.push(current);
            current = char;
          } else current += char;
        }
      } else current = word;
    }
    result.push(current);
  }
  return result;
}
export async function createInvoicePdf(
  order: PublicDocument,
  assets?: { fontBytes: Uint8Array; logoBytes?: Uint8Array },
  studio?: PublicStudio
) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(`${order.documentType} · ${order.title}`);
  pdf.setAuthor("Reverso Works");
  const fontBytes =
    assets?.fontBytes ??
    new Uint8Array(await (await fetch(interUrl)).arrayBuffer());
  const font = await pdf.embedFont(fontBytes, { subset: true });
  const logoBytes =
    assets?.logoBytes ??
    new Uint8Array(
      await (
        await fetch(`${import.meta.env.BASE_URL}reverso-logo-branca.png`)
      ).arrayBuffer()
    );
  const logo = logoBytes ? await pdf.embedPng(logoBytes) : undefined;
  const ink = rgb(3 / 255, 26 / 255, 23 / 255),
    white = rgb(245 / 255, 247 / 255, 250 / 255),
    gold = rgb(198 / 255, 165 / 255, 95 / 255);
  let page: PDFPage;
  let y = 0;
  function addPage() {
    page = pdf.addPage([595.28, 841.89]);
    page.drawRectangle({
      x: 0,
      y: 0,
      width: 595.28,
      height: 841.89,
      color: ink,
    });
    let header = 744;
    if (logo) {
      const width = 125,
        height = (width * logo.height) / logo.width;
      page.drawImage(logo, { x: 44, y: 778 - height, width, height });
      header = 778 - height - 18;
    }
    page.drawText("AUTOMOTIVE STUDIO / GESTOR", {
      x: 44,
      y: header,
      size: 8,
      font,
      color: gold,
    });
    page.drawLine({
      start: { x: 44, y: header - 14 },
      end: { x: 551, y: header - 14 },
      color: gold,
      thickness: 0.6,
    });
    y = header - 34;
  }
  addPage();
  for (const text of invoicePdfLines(order, studio)) {
    if (!text) {
      y -= 9;
      continue;
    }
    const heading = /^[A-ZÁÉÍÓÚÇÃÕ\s]+$/.test(text);
    const size = heading ? 10 : 9.5;
    for (const line of wrapText(text, font, size, 507)) {
      if (y < 74) addPage();
      page!.drawText(line, {
        x: 44,
        y,
        size,
        font,
        color: heading ? gold : white,
      });
      y -= 14;
    }
    if (heading) y -= 4;
  }
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawLine({
      start: { x: 44, y: 50 },
      end: { x: 551, y: 50 },
      color: gold,
      thickness: 0.6,
    });
    p.drawText(
      `Reverso Works · ${order.documentType} · ${i + 1}/${pages.length}`,
      { x: 44, y: 32, size: 8, font, color: gold }
    );
  });
  const bytes = await pdf.save();
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return new Blob([buffer], { type: "application/pdf" });
}
export async function downloadInvoicePdf(
  order: PublicDocument,
  studio?: PublicStudio
) {
  const blob = await createInvoicePdf(order, undefined, studio);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${sanitizeFileName(order.clientName)}-${order.documentType === "Invoice" ? "invoice" : "estimate"}-${sanitizeFileName(order.id)}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
