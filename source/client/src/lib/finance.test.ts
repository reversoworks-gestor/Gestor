import { describe, expect, it } from "vitest";
import { calculateOrderTotals, centsToAmount, printServicePrice, validatePayments } from "./finance";

describe("finance calculations", () => {
  it("calculates the configured printing example as US$ 75.00", () => {
    expect(centsToAmount(printServicePrice({ pricePerGram: 0.03, weightGrams: 250, hours: 4, hourlyRate: 2.5 }))).toBe(75);
  });

  it("applies tax only to taxable items", () => {
    const totals = calculateOrderTotals([
      { quantity: 1, unitPrice: 100, kind: "item", taxable: true },
      { quantity: 2, unitPrice: 50, kind: "service", taxable: false },
    ], 0.1);
    expect(totals).toEqual({ subtotalCents: 20000, taxCents: 1000, totalCents: 21000 });
  });

  it("rejects negative and over-total payments", () => {
    expect(validatePayments(10000, [{ amount: -1 }])).toBeTruthy();
    expect(validatePayments(10000, [{ amount: 101 }])).toBeTruthy();
    expect(validatePayments(10000, [{ amount: 100 }])).toBeNull();
  });
});
