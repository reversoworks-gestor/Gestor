import { describe, expect, it } from "vitest";
import { demoData, normalizeStudioOrder } from "./domain";
import { createWorkflow } from "./jobWorkflow";

const blank = (label: string) => ({
  id: "l1",
  service: "custom" as const,
  kind: "service" as const,
  taxable: false,
  label,
  description: "",
  quantity: 1,
  unit: "unidades" as const,
  unitPrice: 0,
  unitPriceCents: 0,
  pricePending: true,
});

describe("item em branco", () => {
  it("permite um documento só com item livre", () => {
    const data = demoData();
    const order = { ...data.orders[0], workflow: createWorkflow([]), lines: [blank("Taxa de deslocamento")] };
    expect(() => normalizeStudioOrder(order, data)).not.toThrow();
  });
  it("exige nome no item em branco", () => {
    const data = demoData();
    const order = { ...data.orders[0], workflow: createWorkflow([]), lines: [blank("  ")] };
    expect(() => normalizeStudioOrder(order, data)).toThrow("nome");
  });
  it("sem nenhuma linha continua inválido", () => {
    const data = demoData();
    const order = { ...data.orders[0], workflow: createWorkflow([]), lines: [] };
    expect(() => normalizeStudioOrder(order, data)).toThrow();
  });
});
