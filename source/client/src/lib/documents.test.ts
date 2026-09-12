import { describe, expect, it } from "vitest";
import { createInvoiceFromEstimate, nextFutureOrder, normalizeOrderMoney, unifiedSearch } from "./documents";
import { invoicePdfLines } from "./pdf";
import type { Client, Order } from "./models";

const estimate: Order = {
  id: "estimate-1",
  documentType: "Estimativa",
  status: "Rascunho",
  clientId: "client-1",
  clientName: "Cliente Teste",
  title: "Peça",
  dueDate: "2026-09-20",
  startDate: "2026-09-11",
  materialId: "pla",
  materialName: "PLA",
  materialGrams: 250,
  notes: "legado",
  publicNote: "publica",
  privateNote: "segredo privado",
  attachments: [{ name: "peca.stl", storagePath: "workspaces/reverso-private/stl/peca.stl" }],
  payments: [{ id: "p1", method: "Pix", amount: 25, date: "2026-09-11" }],
  lines: [{ id: "l1", service: "hardware", kind: "item", taxable: true, label: "Item", quantity: 2, unitPrice: 10, description: "" }],
  taxRate: 0.1,
  total: 0,
  createdAt: "2026-09-11T00:00:00.000Z",
};

describe("document workflows", () => {
  it("normalizes all monetary values as integer cents", () => {
    const normalized = normalizeOrderMoney(estimate);
    expect(normalized.lines[0].unitPriceCents).toBe(1000);
    expect(normalized.payments?.[0].amountCents).toBe(2500);
    expect(normalized.totalCents).toBe(2200);
  });

  it("converts an estimate without losing data and keeps the link", () => {
    const converted = createInvoiceFromEstimate(estimate, "invoice-1", "2026-09-12T00:00:00.000Z");
    expect(converted.estimate.invoiceId).toBe("invoice-1");
    expect(converted.invoice.sourceEstimateId).toBe("estimate-1");
    expect(converted.invoice.attachments).toEqual(estimate.attachments);
    expect(converted.invoice.payments?.[0].amountCents).toBe(2500);
    expect(converted.invoice.privateNote).toBe("segredo privado");
  });

  it("selects the nearest active future delivery", () => {
    const later = { ...estimate, id: "later", dueDate: "2026-09-30" };
    expect(nextFutureOrder([later, estimate], new Date("2026-09-11T12:00:00"))?.id).toBe("estimate-1");
  });

  it("searches clients, estimates and invoices together", () => {
    const client: Client = { id: "client-1", name: "Ada Lovelace", email: "ada@example.com", phone: "", company: "", address: "", notes: "" };
    expect(unifiedSearch("ada", [client], [estimate]).map((result) => result.kind)).toContain("client");
    expect(unifiedSearch("peca", [client], [estimate]).map((result) => result.kind)).toContain("estimate");
  });

  it("never includes the private note in invoice PDF content", () => {
    const invoice = { ...normalizeOrderMoney(estimate), documentType: "Invoice" as const };
    const lines = invoicePdfLines(invoice).join(" ");
    expect(lines).toContain("publica");
    expect(lines).not.toContain("segredo privado");
  });
});
