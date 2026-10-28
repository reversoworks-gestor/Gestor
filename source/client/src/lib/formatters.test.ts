import { describe, expect, it } from "vitest";
import { normalizeClientIdentity } from "./formatters";

describe("normalizeClientIdentity", () => {
  it("preserves the first and last name exactly as edited", () => {
    expect(normalizeClientIdentity({
      name: "QA Reverso Validation",
      firstName: "QA Reverso",
      lastName: "Validation",
    })).toEqual({
      name: "QA Reverso Validation",
      firstName: "QA Reverso",
      lastName: "Validation",
    });
  });

  it("splits legacy records that only store a full name", () => {
    expect(normalizeClientIdentity({ name: "Ada Lovelace" })).toEqual({
      name: "Ada Lovelace",
      firstName: "Ada",
      lastName: "Lovelace",
    });
  });

  it("does not silently promote a last name when the required first name is blank", () => {
    expect(normalizeClientIdentity({
      name: "Lovelace",
      firstName: "",
      lastName: "Lovelace",
    })).toEqual({
      name: "Lovelace",
      firstName: "",
      lastName: "Lovelace",
    });
  });
});
