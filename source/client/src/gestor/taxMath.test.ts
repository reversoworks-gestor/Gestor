import { describe, expect, it } from "vitest";
import { estimatedDueDates, homeOfficeDeductionCents, mileageTotals, paidEstimated } from "./taxMath";
import type { TaxEntry } from "./types";

const e = (over: Partial<TaxEntry>): TaxEntry => ({ id: "x", kind: "mileage", date: "2026-03-01", ...over });
describe("impostos e deduções", () => {
  it("soma impostos estimados por trimestre e órgão em centavos", () => {
    const list = [
      e({ kind: "estimated", quarter: 1, agency: "Federal", amountCents: 50000 }),
      e({ kind: "estimated", quarter: 1, agency: "Federal", amountCents: 12550 }),
      e({ kind: "estimated", quarter: 1, agency: "Califórnia", amountCents: 9900 }),
      e({ kind: "estimated", quarter: 2, agency: "Federal", amountCents: 700, date: "2026-06-10" }),
    ];
    expect(paidEstimated(list, 2026, 1, "Federal")).toBe(62550);
    expect(paidEstimated(list, 2026, 1, "Califórnia")).toBe(9900);
    expect(paidEstimated(list, 2025, 1, "Federal")).toBe(0);
  });
  it("calcula milhas do ano e dedução só com taxa definida", () => {
    const list = [e({ miles: 12.5 }), e({ miles: 7.5 }), e({ miles: 100, date: "2025-12-31" })];
    expect(mileageTotals(list, 2026)).toEqual({ miles: 20, deductionCents: 0 });
    expect(mileageTotals(list, 2026, 0.5).deductionCents).toBe(1000);
  });
  it("limita o home office a 300 pés quadrados", () => {
    expect(homeOfficeDeductionCents(120)).toBe(60000);
    expect(homeOfficeDeductionCents(400)).toBe(150000);
    expect(homeOfficeDeductionCents(-5)).toBe(0);
  });
  it("o quarto vencimento cai no ano seguinte", () => {
    expect(estimatedDueDates(2026)[3].date).toBe("2027-01-15");
  });
});
