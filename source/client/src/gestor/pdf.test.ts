import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { createInvoicePdf, invoicePdfLines } from "../lib/pdf";
import { demoData } from "./domain";
const require = createRequire(import.meta.url);
describe("PDF automotivo público", () => {
  it("incorpora Inter e logo oficial, preserva conteúdo e gera páginas suficientes", async () => {
    const order = {
      ...demoData().orders[0],
      currency: "BRL" as const,
      privateNote: "SEGREDO-QA-NAO-EXPORTAR",
      publicNote: "Última linha visível no documento",
      scope: "Conferência detalhada da condição e montagem. ".repeat(160),
    };
    const lines = invoicePdfLines(order);
    expect(lines.join("\n")).not.toContain(order.privateNote);
    expect(lines.join("\n")).toContain("BRL");
    expect(lines.join("\n")).toContain(order.publicNote);
    const fontBytes = new Uint8Array(
      readFileSync(
        require.resolve("@fontsource/inter/files/inter-latin-400-normal.woff")
      )
    );
    const logoBytes = new Uint8Array(
      readFileSync(
        new URL("../../public/reverso-logo-branca.png", import.meta.url)
      )
    );
    const blob = await createInvoicePdf(order, { fontBytes, logoBytes });
    const pdf = await PDFDocument.load(await blob.arrayBuffer());
    expect(pdf.getPageCount()).toBeGreaterThan(1);
    expect(pdf.getTitle()).toContain(order.title);
    expect(blob.type).toBe("application/pdf");
  });
  it("inclui contato e rodapé públicos sem copiar a nota privada", () => {
    const order = { ...demoData().orders[0], privateNote: "NAO_EXPORTAR" };
    const lines = invoicePdfLines(order, {
      studioName: "Estúdio técnico",
      address: "Endereço público",
      phone: "Telefone público",
      publicFooter: "Escopo público aprovado",
    });
    expect(lines.join(" ")).toContain("Escopo público aprovado");
    expect(lines.join(" ")).toContain("Endereço público");
    expect(lines.join(" ")).not.toContain("NAO_EXPORTAR");
  });
});
