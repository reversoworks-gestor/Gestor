import { describe, expect, it } from "vitest";
import { demoData, normalizeStudioOrder } from "./domain";
import { createWorkflow } from "./jobWorkflow";
import { addOfficialLines } from "./serviceLines";
import { jobChargeTotals } from "./jobCharges";
import { invoicePdfLines } from "../lib/pdf";

function fixture() {
  const data = demoData();
  const order = {
    ...data.orders[0],
    id: "official-estimate",
    documentType: "Estimativa" as const,
    status: "Rascunho" as const,
    completed: false,
    workflow: createWorkflow(["FAR-01"]),
    lines: addOfficialLines([], "FAR-01"),
    payments: [],
    total: 0,
    totalCents: 0,
    startDate: "",
    dueDate: "",
  };
  data.orders = [];
  return { data, order };
}
function quote() {
  const { data, order } = fixture();
  order.startDate = "2026-11-04";
  order.workflow.quotedAmount = 100;
  order.lines = order.lines.map(line => ({
    ...line,
    unitPrice: 100,
    unitPriceCents: 10000,
    pricePending: false,
  }));
  return { data, order };
}

describe("integração oficial de catálogo e workflow", () => {
  it("salva Lead de avaliação sem inventar emissão, prazo ou preço", () => {
    const { data, order } = fixture();
    const result = normalizeStudioOrder(order, data);
    expect(result.startDate).toBe("");
    expect(result.workflow?.quotedAmount).toBeNull();
    expect(result.workflow?.estimatedDeadline).toBe("");
    expect(result.lines[0].pricePending).toBe(true);
  });
  it("não aceita duas cotações para o mesmo job", () => {
    const { data, order } = quote();
    order.workflow.quotedAmount = 999;
    expect(() => normalizeStudioOrder(order, data)).toThrow("valor orçado");
  });
  it("preserva ajuste final explícito sem alterar o histórico da cotação", () => {
    const { data, order } = quote();
    order.workflow.finalAmount = 120;
    const result = normalizeStudioOrder(order, data);
    expect(result.total).toBe(100);
    expect(jobChargeTotals(result)).toMatchObject({
      quoteCents: 10000,
      totalCents: 12000,
      adjustmentCents: 2000,
      subtotalCents: 12000,
      pending: false,
    });
    const pdf = invoicePdfLines(result).join("\n");
    expect(pdf).toContain("Ajuste explícito");
    expect(pdf).toContain("120,00");
    expect(pdf).toContain("FAR-01");
  });
  it("herda workflow aprovado ao converter estimativa sem salto artificial de Lead", () => {
    const { data, order } = quote();
    order.workflow.stage = "approved";
    order.workflow.problem = "Lente amarelada";
    order.workflow.estimatedDeadline = "2026-11-05";
    order.workflow.beforePhotos = [
      {
        name: "before.jpg",
        contentType: "image/jpeg",
        storagePath: "test/jobs/before.jpg",
      },
    ];
    order.workflow.details["FAR.damageType"] = "Externo";
    order.workflow.tasks["FAR-01"] = { done: true };
    data.orders = [order];
    const invoice = {
      ...order,
      id: "official-invoice",
      documentType: "Invoice" as const,
      sourceEstimateId: order.id,
    };
    expect(normalizeStudioOrder(invoice, data).workflow?.stage).toBe(
      "approved"
    );
    expect(() =>
      normalizeStudioOrder(
        { ...invoice, sourceEstimateId: undefined },
        { ...data, orders: [] }
      )
    ).toThrow("uma etapa");
  });
});
