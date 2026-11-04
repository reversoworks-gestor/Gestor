import { describe, expect, it } from "vitest";
import {
  categoryForCodes,
  expandService,
  findService,
  officialServices,
  serviceCategories,
  validateServiceCodes,
} from "./serviceCatalog";

describe("catálogo oficial de 04/11/2026", () => {
  it("expõe exatamente 21 códigos estáveis, quatro categorias e preços nulos", () => {
    expect(Object.keys(serviceCategories)).toEqual([
      "DET",
      "PDR",
      "FAR",
      "P3D",
    ]);
    expect(officialServices.map(service => service.code)).toEqual([
      "DET-01",
      "DET-02",
      "DET-03",
      "DET-04",
      "DET-05",
      "DET-06",
      "DET-07",
      "PDR-01",
      "PDR-02",
      "PDR-03",
      "FAR-01",
      "FAR-02",
      "P3D-01",
      "P3D-02",
      "P3D-03",
      "P3D-04",
      "P3D-05",
      "P3D-06",
      "PCT-01",
      "PCT-02",
      "PCT-03",
    ]);
    expect(
      officialServices.every(
        service => service.price === null && service.active === true
      )
    ).toBe(true);
    expect(
      officialServices
        .filter(service => service.category === null)
        .map(service => service.type)
    ).toEqual(["Pacote", "Pacote", "Pacote"]);
    expect(findService("P3D-04")?.type).toBe("Principal B2B");
    expect(findService("PPF")).toBeUndefined();
  });
});

describe("composição e dependências", () => {
  it("lança códigos individuais dos pacotes, sem inserir uma categoria Pacote", () => {
    expect(expandService("PCT-01")).toEqual([
      "DET-02",
      "DET-04",
      "DET-05",
      "FAR-01",
      "FAR-02",
    ]);
    expect(expandService("PCT-02")).toEqual(["PDR-01", "PDR-02", "DET-01"]);
    expect(categoryForCodes(expandService("PCT-01"))).toEqual(["DET", "FAR"]);
    expect(categoryForCodes(["PCT-03"])).toEqual(["P3D"]);
  });
  it("nunca escolhe silenciosamente a alternativa de The Missing Part", () => {
    expect(() => expandService("PCT-03")).toThrow("explicitamente");
    expect(() => expandService("PCT-03", "P3D-05")).toThrow();
    expect(expandService("PCT-03", "P3D-01")).toEqual([
      "P3D-01",
      "P3D-03",
      "P3D-06",
    ]);
    expect(expandService("PCT-03", "P3D-02")).toEqual([
      "P3D-02",
      "P3D-03",
      "P3D-06",
    ]);
  });
  it.each([
    "DET-03",
    "DET-04",
    "PDR-02",
    "PDR-03",
    "FAR-02",
    "P3D-03",
    "P3D-06",
  ])("bloqueia o add-on %s sem pré-requisito", code => {
    expect(() => validateServiceCodes([code])).toThrow("pré-requisito");
  });
  it.each([
    ["DET-01", "DET-03"],
    ["DET-02", "DET-03", "DET-04"],
    ["DET-05", "DET-06", "DET-07"],
    ["PDR-01", "PDR-02", "PDR-03"],
    ["FAR-01", "FAR-02"],
    ["P3D-01", "P3D-03", "P3D-06"],
    ["P3D-02", "P3D-03", "P3D-06"],
    ["P3D-05", "P3D-06"],
  ])("aceita a composição válida %j", (...codes) => {
    expect(() => validateServiceCodes(codes)).not.toThrow();
  });
  it("rejeita serviços excluídos, pacote não expandido e lista vazia", () => {
    expect(() => validateServiceCodes(["PPF"])).toThrow("desconhecido");
    expect(() => validateServiceCodes(["PCT-01"])).toThrow("expanda");
    expect(() => validateServiceCodes([])).toThrow("Selecione");
    expect(() => expandService("ENGINE")).toThrow("desconhecido");
    expect(() => expandService("DET-01", "DET-02")).toThrow("alternativa");
  });
});
