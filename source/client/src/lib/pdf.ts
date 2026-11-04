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
  new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
/** Deliberately excludes privateNote and internal inspection annotations. No line truncation. */
export function invoicePdfLines(order: PublicDocument, studio?: PublicStudio) {
  const currency = order.currency ?? "USD";
  const charges = jobChargeTotals(order);
  const pending = charges.pending;
  const type = order.documentType === "Invoice" ? "INVOICE" : "ESTIMATIVA";
  return [
    `${type} · ${order.id}`,
    ...(studio?.studioName ? [`Estúdio: ${studio.studioName}`] : []),
    ...(studio?.address ? [`Endereço: ${studio.address}`] : []),
    ...([studio?.phone, studio?.email].filter(Boolean).length
      ? [
          `Contato do estúdio: ${[studio?.phone, studio?.email].filter(Boolean).join(" · ")}`,
        ]
      : []),
    `Cliente: ${order.clientSnapshot?.name || order.clientName}`,
    ...(order.clientSnapshot?.company
      ? [`Empresa: ${order.clientSnapshot.company}`]
      : []),
    ...(order.clientSnapshot?.email
      ? [`Contato: ${order.clientSnapshot.email}`]
      : []),
    `Emissão: ${order.startDate || order.createdAt.slice(0, 10)} · Entrega: ${order.dueDate || "A definir"}`,
    `Estado: ${order.workflow ? pipeline.find(stage => stage.id === order.workflow?.stage)?.name : order.status} · Moeda: ${currency}`,
    ...(order.workflow?.packageCode
      ? [`Pacote: ${order.workflow.packageCode} (serviços individuais abaixo)`]
      : []),
    "",
    "ITENS E SERVIÇOS",
    ...order.lines.flatMap((line, index) => [
      `${index + 1}. ${line.serviceCode ? line.serviceCode + " · " : ""}${line.label}`,
      line.description || "Escopo descrito abaixo.",
      line.pricePending
        ? "Preço: por avaliação — ainda não orçado."
        : `${line.quantity} ${line.unit ?? "unidades"} × ${amount(centsToAmount(line.unitPriceCents ?? toCents(line.unitPrice)), currency)}`,
    ]),
    "",
    pending
      ? "Subtotal: a definir por avaliação"
      : `Subtotal: ${amount(centsToAmount(charges.subtotalCents), currency)}`,
    pending
      ? "Impostos: a definir"
      : `Impostos: ${amount(centsToAmount(charges.taxCents), currency)}`,
    ...(order.workflow && charges.adjustmentCents
      ? [
          `Ajuste explícito sobre a cotação: ${amount(centsToAmount(charges.adjustmentCents), currency)} — incluído no total cobrado.`,
        ]
      : []),
    pending
      ? "Total: a definir por avaliação"
      : `Total: ${amount(centsToAmount(charges.totalCents), currency)}`,
    "",
    ...(order.workflow
      ? [
          "FINANCEIRO DO JOB",
          `Valor orçado: ${order.workflow.quotedAmount === null ? "A definir por avaliação" : amount(order.workflow.quotedAmount, currency)}`,
          `Valor final cobrado: ${order.workflow.finalAmount === null ? "Ainda não definido" : amount(order.workflow.finalAmount, currency)}`,
          `Saldo: ${workflowPayment(order.workflow, order.payments ?? []).balance === null ? "A definir" : amount(workflowPayment(order.workflow, order.payments ?? []).balance!, currency)}`,
          "",
        ]
      : []),
    "PAGAMENTOS",
    ...(order.payments?.length
      ? order.payments.map(
          p =>
            `${p.date} · ${p.method} · ${amount(centsToAmount(p.amountCents ?? toCents(p.amount)), currency)}`
        )
      : ["Nenhum pagamento registrado."]),
    ...(order.scope ? ["", "ESCOPO", order.scope] : []),
    ...(order.constraints
      ? ["", "PREMISSAS E LIMITES", order.constraints]
      : []),
    "",
    "NOTA PÚBLICA",
    order.publicNote || "Sem observações públicas.",
    "",
    studio?.publicFooter || "Restore. Refine. Recreate.",
    "A execução depende da avaliação, do escopo aprovado e das verificações de entrega. Este documento não substitui validação de componentes críticos.",
  ];
}
function wrapText(text: string, font: PDFFont, size: number, width: number) {
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
  anchor.download = `${sanitizeFileName(order.clientName)}-${order.documentType === "Invoice" ? "invoice" : "estimativa"}-${sanitizeFileName(order.id)}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
