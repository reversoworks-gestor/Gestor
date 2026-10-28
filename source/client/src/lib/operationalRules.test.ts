import { describe, expect, it } from "vitest";
import {
  formatDateTimeLocal,
  isValidEmail,
  moveStock,
  parseWallsAndInfill,
  reconcileReservation,
} from "./operationalRules";

describe("formatDateTimeLocal", () => {
  it("formats local date parts without converting through UTC", () => {
    const date = new Date(2026, 9, 27, 18, 11, 0, 0);
    expect(formatDateTimeLocal(date)).toBe("2026-10-27T18:11");
  });

  it("preserves non-zero seconds and milliseconds and rejects invalid dates", () => {
    expect(formatDateTimeLocal(new Date(2026, 0, 2, 3, 4, 5, 6))).toBe("2026-01-02T03:04:05.006");
    expect(formatDateTimeLocal(new Date(Number.NaN))).toBeNull();
  });
});

describe("moveStock", () => {
  it("adds and removes the exact requested quantity", () => {
    expect(moveStock(10, 2.5, "in")).toEqual({ ok: true, balance: 12.5, quantity: 2.5 });
    expect(moveStock(10, 2.5, "out")).toEqual({ ok: true, balance: 7.5, quantity: 2.5 });
  });

  it("allows exact depletion but explicitly rejects an outbound quantity above stock", () => {
    expect(moveStock(4, 4, "out")).toEqual({ ok: true, balance: 0, quantity: 4 });
    expect(moveStock(4, 4.01, "out")).toEqual({ ok: false, error: "insufficient-stock" });
  });

  it("rejects invalid balances and non-positive or non-finite quantities", () => {
    expect(moveStock(-1, 1, "in")).toEqual({ ok: false, error: "invalid-balance" });
    expect(moveStock(1, Number.POSITIVE_INFINITY, "out")).toEqual({ ok: false, error: "invalid-quantity" });
    expect(moveStock(1, 0, "in")).toEqual({ ok: false, error: "invalid-quantity" });
  });
});

describe("reconcileReservation", () => {
  it("returns the old reservation and debits a different material", () => {
    const stock = { pla: 20, petg: 12 };
    expect(reconcileReservation(stock, { materialId: "pla", quantity: 5 }, { materialId: "petg", quantity: 7 })).toEqual({
      ok: true,
      balances: { pla: 25, petg: 5 },
      released: { materialId: "pla", quantity: 5 },
      reserved: { materialId: "petg", quantity: 7 },
    });
    expect(stock).toEqual({ pla: 20, petg: 12 });
  });

  it("reconciles changed quantity for the same material and supports no reservation", () => {
    expect(reconcileReservation({ pla: 8 }, { materialId: "pla", quantity: 3 }, { materialId: "pla", quantity: 6 })).toMatchObject({
      ok: true,
      balances: { pla: 5 },
    });
    expect(reconcileReservation({ pla: 8 }, { materialId: "pla", quantity: 3 }, null)).toMatchObject({
      ok: true,
      balances: { pla: 11 },
    });
  });

  it("fails atomically when the new reservation exceeds restored stock", () => {
    const stock = { pla: 2 };
    expect(reconcileReservation(stock, null, { materialId: "pla", quantity: 3 })).toEqual({ ok: false, error: "insufficient-stock" });
    expect(reconcileReservation(stock, { materialId: "pla", quantity: 1 }, { materialId: "pla", quantity: 4 })).toEqual({ ok: false, error: "insufficient-stock" });
    expect(stock).toEqual({ pla: 2 });
  });

  it("reports invalid reservations, missing materials, and invalid stock", () => {
    expect(reconcileReservation({}, null, { materialId: "pla", quantity: 1 })).toEqual({ ok: false, error: "missing-stock" });
    expect(reconcileReservation({ pla: Number.NaN }, null, { materialId: "pla", quantity: 1 })).toEqual({ ok: false, error: "invalid-stock" });
    expect(reconcileReservation({ pla: 2 }, null, { materialId: "pla", quantity: 0 })).toEqual({ ok: false, error: "invalid-reservation" });
  });
});

describe("parseWallsAndInfill", () => {
  it("parses the slash format, optional spaces, and decimal comma", () => {
    expect(parseWallsAndInfill("3 / 50%")).toEqual({ ok: true, value: { walls: 3, infillPercent: 50 } });
    expect(parseWallsAndInfill(" 20/ 12,5 % ")).toEqual({ ok: true, value: { walls: 20, infillPercent: 12.5 } });
  });

  it("accepts boundary values and rejects malformed or out-of-range values", () => {
    expect(parseWallsAndInfill("1 / 0%")).toEqual({ ok: true, value: { walls: 1, infillPercent: 0 } });
    expect(parseWallsAndInfill("21 / 50%")).toEqual({ ok: false, error: "walls-out-of-range" });
    expect(parseWallsAndInfill("3 / 100.1%")).toEqual({ ok: false, error: "infill-out-of-range" });
    expect(parseWallsAndInfill("3-50%")).toEqual({ ok: false, error: "invalid-format" });
  });

  it("rejects fractional wall counts and non-numeric infill", () => {
    expect(parseWallsAndInfill("2.5 / 50%")).toEqual({ ok: false, error: "invalid-walls" });
    expect(parseWallsAndInfill("3 / many%")).toEqual({ ok: false, error: "invalid-infill" });
  });
});

describe("isValidEmail", () => {
  it("accepts a simple address with a valid dotted domain and TLD", () => {
    expect(isValidEmail("first.last+tag@example.co")).toBe(true);
    expect(isValidEmail("user@sub.example.com")).toBe(true);
  });

  it("rejects whitespace, malformed local parts, missing domains, and invalid TLDs", () => {
    expect(isValidEmail(" user@example.com")).toBe(false);
    expect(isValidEmail("user name@example.com")).toBe(false);
    expect(isValidEmail("a..b@example.com")).toBe(false);
    expect(isValidEmail("user@localhost")).toBe(false);
    expect(isValidEmail("user@example.1a")).toBe(false);
    expect(isValidEmail("user@@example.com")).toBe(false);
  });
});
