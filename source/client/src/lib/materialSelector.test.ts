import { describe, expect, it } from "vitest";
import { calculateSelector, defaultSelectorForm, materialDatabase, type SelectorForm } from "./materialSelector";

const form = (overrides: Partial<SelectorForm>): SelectorForm => ({ ...defaultSelectorForm, project: "Teste", ...overrides });
const stock = materialDatabase.map((item) => ({ id: item.name, name: item.name, color: "Preto", type: item.family, availableGrams: 1000, reorderAtGrams: 100, pricePerGram: item.costKg / 1000, nozzleTemp: "", bedTemp: "", printNotes: "" }));

 describe("material selector v3", () => {
  it("applies thermal and UV hard gates for automotive exterior", () => {
    const result = calculateSelector(form({ continuousTemp: 110, peakTemp: 145, uv: "Alta / contínua", environment: "Exterior / intempéries" }), stock, []);
    expect(["PLA", "PETG"]).not.toContain(result.primary?.name);
    expect(result.rejected.length).toBeGreaterThan(0);
  });
  it("rejects engine-bay candidates for chemical and process incompatibility", () => {
    const result = calculateSelector(form({ continuousTemp: 110, peakTemp: 140, chemical: "Combustível / químico relevante", rigidity: "Muito alta", printerNozzleMax: 300, printerChamberMax: 40, hardenedNozzle: false }), stock, []);
    expect(result.primary?.name).not.toBe("PLA");
    expect(result.rejected.length).toBeGreaterThan(0);
  });
  it("keeps flexible requirements from recommending rigid plastics", () => {
    const result = calculateSelector(form({ flexibility: "Precisa ser flexível", continuousTemp: 40, peakTemp: 50 }), stock, []);
    expect(result.primary?.name).toBe("TPU 95A");
    expect(result.primary?.name).toBe("TPU 95A");
  });
  it("returns no safe recommendation when every material fails", () => {
    const result = calculateSelector(form({ continuousTemp: 300, peakTemp: 350, chemical: "Solvente / agente severo", uv: "Alta / contínua", rigidity: "Muito alta", requireStock: true }), [], []);
    expect(result.primary).toBeNull();
    expect(result.rejected.length).toBeGreaterThan(0);
  });
  it("uses the selected printer profile as a hard process gate", () => {
    const result = calculateSelector(form({ continuousTemp: 120, peakTemp: 145, printerId: "small", printerNozzleMax: 300, printerChamberMax: 50, hardenedNozzle: false }), stock, [{ id: "small", name: "Small", model: "S1", status: "Pronta", material: "", lastMaintenance: "", maintenance: [], maxNozzleTemp: 240, maxChamberTemp: 20, hardenedNozzle: false }]);
    expect(result.rejected.some((item) => item.name === "PA6-CF")).toBe(true);
  });
  it("prefers traceable technical overrides from inventory records", () => {
    const traceableStock = [{ ...stock[0], name: "ASA", continuousServiceTemp: 125, peakServiceTemp: 145, hdt045: 135, dataSource: "Datasheet fabricante", confidenceLevel: "Alta" as const }];
    const result = calculateSelector(form({ continuousTemp: 110, peakTemp: 140, uv: "Alta / contínua" }), traceableStock, []);
    expect(result.primary?.name).toBe("ASA");
    expect(result.primary?.continuous).toBe(125);
  });
});
