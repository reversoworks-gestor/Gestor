import { describe, expect, it } from "vitest";
import { addOfficialLines, pendingPricing } from "./serviceLines";

describe("composição de serviços no orçamento", () => {
  it("lança serviços de Bring It Back sem preço tabelado ou linha executável de pacote", () => {
    const lines = addOfficialLines([], "PCT-01");
    expect(lines.map(line => line.serviceCode)).toEqual([
      "DET-02",
      "DET-04",
      "DET-05",
      "FAR-01",
      "FAR-02",
    ]);
    expect(
      lines.every(line => line.pricePending && line.packageCode === "PCT-01")
    ).toBe(true);
    expect(pendingPricing(lines)).toBe(true);
    expect(lines.some(line => line.serviceCode === "PCT-01")).toBe(false);
  });
  it("exige escolha explícita da base de The Missing Part", () => {
    expect(() => addOfficialLines([], "PCT-03")).toThrow();
    expect(
      addOfficialLines([], "PCT-03", "P3D-02").map(line => line.serviceCode)
    ).toEqual(["P3D-02", "P3D-03", "P3D-06"]);
  });
  it("bloqueia proteção ou touch-up sem principal no mesmo job", () => {
    expect(() => addOfficialLines([], "DET-04")).toThrow();
    expect(() => addOfficialLines([], "PDR-02")).toThrow();
    const main = addOfficialLines([], "PDR-01");
    expect(
      addOfficialLines(main, "PDR-02").map(line => line.serviceCode)
    ).toEqual(["PDR-01", "PDR-02"]);
    expect(main).toHaveLength(1);
  });
  it("não duplica serviços e nunca aceita itens fora do cadastro", () => {
    const lines = addOfficialLines([], "FAR-01");
    expect(addOfficialLines(lines, "FAR-01")).toHaveLength(1);
    expect(() => addOfficialLines([], "PPF")).toThrow();
  });
});

it("associa componentes já existentes ao pacote sem alterar IDs ou preços", () => {
  const original = addOfficialLines(
    addOfficialLines(addOfficialLines([], "PDR-01"), "PDR-02"),
    "DET-01"
  ).map(line => ({ ...line, unitPrice: 29, pricePending: false }));
  const next = addOfficialLines(original, "PCT-02");
  expect(next).toHaveLength(3);
  expect(next.map(line => line.packageCode)).toEqual([
    "PCT-02",
    "PCT-02",
    "PCT-02",
  ]);
  expect(
    next.map(line => [line.id, line.unitPrice, line.pricePending])
  ).toEqual(original.map(line => [line.id, line.unitPrice, line.pricePending]));
  expect(original.every(line => !line.packageCode)).toBe(true);
});
