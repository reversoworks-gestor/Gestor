import type { Order } from "./models";
import { centsToAmount, sanitizeFileName } from "./finance";

function ascii(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "?");
}

function escapePdf(value: string) {
  return ascii(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function wrap(value: string, width = 88) {
  const words = ascii(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (`${current} ${word}`.trim().length > width && current) {
      lines.push(current);
      current = word;
    } else current = `${current} ${word}`.trim();
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

export function invoicePdfLines(order: Order) {
  const lines = [
    "REVERSO WORKS",
    `INVOICE ${order.id}`,
    `Cliente: ${order.clientName}`,
    `Emissao: ${order.startDate || order.createdAt.slice(0, 10)}`,
    `Entrega: ${order.dueDate || "a definir"}`,
    "",
    "Itens e servicos",
    ...order.lines.flatMap((line) => wrap(`${line.label} - ${line.description || "Sem descricao"} | ${line.quantity} x US$ ${centsToAmount(line.unitPriceCents ?? Math.round(line.unitPrice * 100)).toFixed(2)}`)),
    "",
    `Subtotal: US$ ${centsToAmount(order.subtotalCents ?? Math.round((order.subtotal ?? order.total) * 100)).toFixed(2)}`,
    `Tax: US$ ${centsToAmount(order.taxCents ?? Math.round((order.tax ?? 0) * 100)).toFixed(2)}`,
    `Total: US$ ${centsToAmount(order.totalCents ?? Math.round(order.total * 100)).toFixed(2)}`,
    "",
    "Nota publica",
    ...wrap(order.publicNote || "Sem observacoes publicas."),
  ];
  return lines.slice(0, 52);
}

export function createInvoicePdf(order: Order) {
  const content = [
    "BT",
    "/F1 11 Tf",
    "50 760 Td",
    "14 TL",
    ...invoicePdfLines(order).flatMap((line) => [`(${escapePdf(line)}) Tj`, "T*"]),
    "ET",
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${new TextEncoder().encode(content).length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(new TextEncoder().encode(pdf).length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = new TextEncoder().encode(pdf).length;
  const xrefLineEnd = String.fromCharCode(32, 10);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f${xrefLineEnd}`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n${xrefLineEnd}`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

export function downloadInvoicePdf(order: Order) {
  const blob = createInvoicePdf(order);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${sanitizeFileName(order.clientName)}-invoice-${sanitizeFileName(order.id)}.pdf`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
