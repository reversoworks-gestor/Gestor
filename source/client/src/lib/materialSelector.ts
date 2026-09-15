import type { Material, Printer as PrinterModel } from "@/lib/models";

export type SelectorForm = {
  project: string;
  function: string;
  preset: string;
  environment: string;
  humidity: string;
  continuousTemp: number;
  peakTemp: number;
  uv: string;
  chemical: string;
  rigidity: string;
  flexibility: string;
  impact: string;
  dimensional: string;
  serviceLife: number;
  safetyFactor: number;
  loadModel: string;
  force: number;
  area: number;
  length: number;
  width: number;
  thickness: number;
  orientation: "XY" | "Z";
  loadPath: string;
  cycles: number;
  duration: string;
  walls: number;
  infill: number;
  layerHeight: number;
  nozzleDiameter: number;
  hardenedNozzle: boolean;
  chamber: string;
  drying: string;
  printerId: string;
  printerNozzleMax: number;
  printerChamberMax: number;
  partMass: number;
  costLimit: number;
  preferStock: boolean;
  requireStock: boolean;
};

export type MaterialSpec = {
  name: string;
  family: string;
  variant: string;
  reinforcement: string;
  tensileXY: number;
  tensileZ: number;
  modulus: number;
  flexural: number;
  impactXY: number;
  impactZ: number;
  elongation: number;
  creep: number;
  fatigue: number;
  hdt: number;
  continuous: number;
  peak: number;
  uv: number;
  water: number;
  moisture: number;
  chemical: number;
  fuel: number;
  processNozzleMin: number;
  processNozzleMax: number;
  bed: string;
  chamber: string;
  chamberMin: number;
  drying: string;
  abrasive: boolean;
  hardenedRequired: boolean;
  costKg: number;
  notes: string;
};

export type MaterialCandidate = MaterialSpec & {
  stockGrams: number;
  status: "PASS" | "MARGINAL" | "FAIL";
  score: number;
  reasons: string[];
  tradeoff: string;
  cost: number;
  stress?: number;
  safetyFactor?: number;
  confidence: number;
};

export type SelectorResult = {
  primary: MaterialCandidate | null;
  alternatives: MaterialCandidate[];
  rejected: MaterialCandidate[];
  confidence: number;
  missing: string[];
  stress?: number;
  deflection?: number;
  algorithmVersion: "material-selector-v3";
};

export const materialDatabase: MaterialSpec[] = [
  { name: "PLA", family: "PLA", variant: "Standard", reinforcement: "Nenhum", tensileXY: 55, tensileZ: 32, modulus: 3500, flexural: 90, impactXY: 5, impactZ: 3, elongation: 6, creep: 2, fatigue: 2, hdt: 55, continuous: 45, peak: 55, uv: 2, water: 3, moisture: 3, chemical: 2, fuel: 1, processNozzleMin: 195, processNozzleMax: 225, bed: "50–60 °C", chamber: "Aberta", chamberMin: 0, drying: "45 °C / 6 h", abrasive: false, hardenedRequired: false, costKg: 22, notes: "Fácil de imprimir, indicado para protótipos e peças sem carga térmica." },
  { name: "PETG", family: "PETG", variant: "Standard", reinforcement: "Nenhum", tensileXY: 50, tensileZ: 35, modulus: 2100, flexural: 72, impactXY: 8, impactZ: 5, elongation: 12, creep: 4, fatigue: 4, hdt: 72, continuous: 65, peak: 75, uv: 5, water: 5, moisture: 4, chemical: 5, fuel: 3, processNozzleMin: 230, processNozzleMax: 255, bed: "70–85 °C", chamber: "Aberta", chamberMin: 0, drying: "65 °C / 6 h", abrasive: false, hardenedRequired: false, costKg: 28, notes: "Bom equilíbrio para protótipos funcionais e peças com contato químico moderado." },
  { name: "ASA", family: "ASA", variant: "Outdoor", reinforcement: "Nenhum", tensileXY: 45, tensileZ: 30, modulus: 2200, flexural: 70, impactXY: 12, impactZ: 7, elongation: 15, creep: 5, fatigue: 6, hdt: 95, continuous: 85, peak: 105, uv: 9, water: 8, moisture: 5, chemical: 6, fuel: 5, processNozzleMin: 240, processNozzleMax: 270, bed: "90–110 °C", chamber: "Fechada", chamberMin: 35, drying: "70 °C / 6 h", abrasive: false, hardenedRequired: false, costKg: 32, notes: "Resistência UV e estabilidade adequadas para exterior e automotivo." },
  { name: "ABS", family: "ABS", variant: "Engineering", reinforcement: "Nenhum", tensileXY: 42, tensileZ: 27, modulus: 2000, flexural: 68, impactXY: 16, impactZ: 9, elongation: 18, creep: 5, fatigue: 6, hdt: 88, continuous: 78, peak: 98, uv: 3, water: 6, moisture: 5, chemical: 6, fuel: 5, processNozzleMin: 235, processNozzleMax: 265, bed: "90–110 °C", chamber: "Fechada", chamberMin: 30, drying: "70 °C / 6 h", abrasive: false, hardenedRequired: false, costKg: 30, notes: "Tenaz e resistente a impacto, mas exige controle térmico e não é ideal para UV." },
  { name: "PA6-CF", family: "Nylon", variant: "PA6", reinforcement: "Carbon fiber", tensileXY: 95, tensileZ: 48, modulus: 7500, flexural: 145, impactXY: 10, impactZ: 5, elongation: 3, creep: 8, fatigue: 8, hdt: 180, continuous: 130, peak: 160, uv: 5, water: 4, moisture: 1, chemical: 8, fuel: 8, processNozzleMin: 270, processNozzleMax: 320, bed: "80–100 °C", chamber: "Alta temperatura", chamberMin: 50, drying: "80 °C / 8 h", abrasive: true, hardenedRequired: true, costKg: 95, notes: "Alta rigidez e margem térmica; exige secagem rigorosa, câmara e bico endurecido." },
  { name: "TPU 95A", family: "TPU", variant: "95A", reinforcement: "Nenhum", tensileXY: 35, tensileZ: 28, modulus: 80, flexural: 12, impactXY: 35, impactZ: 25, elongation: 450, creep: 4, fatigue: 9, hdt: 80, continuous: 65, peak: 80, uv: 6, water: 7, moisture: 4, chemical: 5, fuel: 3, processNozzleMin: 220, processNozzleMax: 250, bed: "40–60 °C", chamber: "Aberta", chamberMin: 0, drying: "55 °C / 5 h", abrasive: false, hardenedRequired: false, costKg: 55, notes: "Opção flexível para isoladores, gaxetas e absorção de vibração." },
];

export const selectorPresets: Record<string, Partial<SelectorForm>> = {
  "Automotivo — Interior / suporte": { environment: "Interior", humidity: "Normal / controlada", continuousTemp: 70, peakTemp: 90, uv: "Moderada", chemical: "Óleo / graxa / fluidos comuns", rigidity: "Alta", impact: "Alta / relevante", dimensional: "Alta / tolerância crítica", safetyFactor: 2.0 },
  "Automotivo — Dashboard / console": { environment: "Interior", humidity: "Normal / controlada", continuousTemp: 75, peakTemp: 95, uv: "Moderada", chemical: "Óleo / graxa / fluidos comuns", rigidity: "Alta", impact: "Alta / relevante", dimensional: "Alta / tolerância crítica", safetyFactor: 2.0 },
  "Automotivo — Engine Bay": { environment: "Automotivo / motor", humidity: "Alta / condensação", continuousTemp: 110, peakTemp: 140, uv: "Moderada", chemical: "Combustível / químico relevante", rigidity: "Muito alta", impact: "Alta / relevante", dimensional: "Alta / tolerância crítica", safetyFactor: 2.5, chamber: "Fechada", hardenedNozzle: true },
  "Automotivo — Exterior": { environment: "Exterior / intempéries", humidity: "Água / exposição direta", continuousTemp: 75, peakTemp: 100, uv: "Alta / contínua", chemical: "Óleo / graxa / fluidos comuns", rigidity: "Alta", impact: "Alta / relevante", safetyFactor: 2.0 },
  "Suporte estrutural": { rigidity: "Alta", impact: "Alta / relevante", dimensional: "Alta / tolerância crítica", safetyFactor: 2.5, loadModel: "Tração / compressão axial" },
  "Carcaça eletrônica": { environment: "Interior", continuousTemp: 55, peakTemp: 70, rigidity: "Normal", dimensional: "Alta / tolerância crítica", safetyFactor: 2.0 },
  "Snap-fit / clip": { rigidity: "Normal", flexibility: "Precisa ser flexível", impact: "Alta / relevante", dimensional: "Alta / tolerância crítica", safetyFactor: 1.8 },
  "Jig / fixture": { rigidity: "Alta", dimensional: "Alta / tolerância crítica", continuousTemp: 60, peakTemp: 80, safetyFactor: 2.0 },
  "Protótipo / fit check": { rigidity: "Normal", dimensional: "Alta / tolerância crítica", continuousTemp: 35, peakTemp: 45, safetyFactor: 1.5, preferStock: true },
  "Peça visual / acabamento": { rigidity: "Normal", dimensional: "Normal", continuousTemp: 35, peakTemp: 45, safetyFactor: 1.2, preferStock: true, preferCost: true } as Partial<SelectorForm>,
};

export const defaultSelectorForm: SelectorForm = {
  project: "", function: "suporte", preset: "Protótipo / fit check", environment: "Interior", humidity: "Normal / controlada", continuousTemp: 35, peakTemp: 45, uv: "Nenhuma", chemical: "Nenhuma relevante", rigidity: "Normal", flexibility: "Peça rígida", impact: "Baixa / não determinante", dimensional: "Normal", serviceLife: 1, safetyFactor: 2, loadModel: "Sem cálculo mecânico", force: 0, area: 0, length: 0, width: 0, thickness: 0, orientation: "XY", loadPath: "Predominantemente no plano", cycles: 0, duration: "Curta / eventual", walls: 4, infill: 25, layerHeight: 0.2, nozzleDiameter: 0.4, hardenedNozzle: false, chamber: "não informado", drying: "não confirmado", printerId: "", printerNozzleMax: 300, printerChamberMax: 50, partMass: 100, costLimit: 0, preferStock: false, requireStock: false,
};

const level = (value: string) => value.includes("Muito") || value.includes("Alta") ? 3 : value.includes("Normal") ? 2 : 1;

export function calculateSelector(form: SelectorForm, stock: Material[], printers: PrinterModel[]): SelectorResult {
  const printer = printers.find((item) => item.id === form.printerId);
  const nozzleMax = printer ? Number((printer as PrinterModel & { maxNozzleTemp?: number }).maxNozzleTemp || form.printerNozzleMax) : form.printerNozzleMax;
  const chamberMax = printer ? Number((printer as PrinterModel & { maxChamberTemp?: number }).maxChamberTemp || form.printerChamberMax) : form.printerChamberMax;
  const stress = form.loadModel !== "Sem cálculo mecânico" && form.force > 0 && form.area > 0 ? form.force / form.area : undefined;
  const missing = [
    !form.project && "nome da peça / projeto",
    !form.continuousTemp && "temperatura contínua",
    !form.force && "força máxima",
    !form.area && "área resistente",
    !form.cycles && "número de ciclos",
    form.drying === "não confirmado" && "condição de secagem",
  ].filter(Boolean) as string[];
  const candidates = materialDatabase.map((baseSpec): MaterialCandidate => {
    const inventory = stock.find((item) => item.name.toLowerCase().includes(baseSpec.name.toLowerCase()) || baseSpec.name.toLowerCase().includes(item.name.toLowerCase()));
    const spec: MaterialSpec = {
      ...baseSpec,
      family: inventory?.family || inventory?.type || baseSpec.family,
      variant: inventory?.variant || baseSpec.variant,
      reinforcement: inventory?.reinforcement || baseSpec.reinforcement,
      tensileXY: inventory?.tensileStrengthXY ?? baseSpec.tensileXY,
      tensileZ: inventory?.tensileStrengthZ ?? baseSpec.tensileZ,
      modulus: inventory?.youngModulus ?? baseSpec.modulus,
      flexural: inventory?.flexuralStrength ?? baseSpec.flexural,
      impactXY: inventory?.impactStrengthXY ?? baseSpec.impactXY,
      impactZ: inventory?.impactStrengthZ ?? baseSpec.impactZ,
      elongation: inventory?.elongationAtBreak ?? baseSpec.elongation,
      creep: inventory?.creepResistance ?? baseSpec.creep,
      fatigue: inventory?.fatigueResistance ?? baseSpec.fatigue,
      hdt: inventory?.hdt045 ?? baseSpec.hdt,
      continuous: inventory?.continuousServiceTemp ?? baseSpec.continuous,
      peak: inventory?.peakServiceTemp ?? baseSpec.peak,
      uv: inventory?.uvResistance ?? baseSpec.uv,
      water: inventory?.waterResistance ?? baseSpec.water,
      moisture: inventory?.moistureSensitivity ?? baseSpec.moisture,
      chemical: inventory?.oilResistance ?? baseSpec.chemical,
      fuel: inventory?.gasolineResistance ?? baseSpec.fuel,
      processNozzleMin: inventory?.nozzleMinTemp ?? baseSpec.processNozzleMin,
      processNozzleMax: inventory?.nozzleMaxTemp ?? baseSpec.processNozzleMax,
      chamber: inventory?.chamberRequirement || baseSpec.chamber,
      drying: inventory?.dryingTemperature ? `${inventory.dryingTemperature} °C / ${inventory.dryingTimeHours || 0} h` : baseSpec.drying,
      abrasive: inventory?.abrasive ?? baseSpec.abrasive,
      hardenedRequired: inventory?.hardenedNozzleRequired ?? baseSpec.hardenedRequired,
      costKg: inventory ? inventory.pricePerGram * 1000 : baseSpec.costKg,
      notes: inventory?.technicalNotes || inventory?.printNotes || baseSpec.notes,
    };
    const stockGrams = inventory?.availableGrams || 0;
    const reasons: string[] = [];
    const critical: string[] = [];
    if (form.continuousTemp > spec.continuous || form.peakTemp > spec.peak) critical.push("margem térmica insuficiente");
    if (form.uv.includes("Alta") && spec.uv < 7) critical.push("resistência UV insuficiente");
    if (form.chemical.includes("Combustível") && spec.fuel < 6) critical.push("compatibilidade com combustível insuficiente");
    if (form.chemical.includes("Solvente") && spec.chemical < 8) critical.push("resistência química insuficiente");
    if (form.rigidity.includes("Muito") && spec.modulus < 3000) critical.push("rigidez abaixo do requisito");
    if (form.rigidity.includes("Alta") && spec.modulus < 1800) critical.push("rigidez abaixo do requisito");
    if (form.flexibility.includes("flexível") && spec.elongation < 50) critical.push("material rígido para uma peça flexível");
    if (form.requireStock && stockGrams <= 0) critical.push("material não localizado no estoque");
    if (spec.processNozzleMin > nozzleMax) critical.push("temperatura mínima de processamento excede a impressora");
    if (spec.chamberMin > chamberMax && spec.chamberMin > 0) critical.push("requisito de câmara excede a capacidade configurada");
    if (spec.hardenedRequired && !form.hardenedNozzle) critical.push("hardened nozzle obrigatório não disponível");
    if (form.costLimit > 0 && spec.costKg > form.costLimit) critical.push("custo/kg acima do limite");
    const relevantTensile = form.orientation === "Z" ? spec.tensileZ : spec.tensileXY;
    const safetyFactor = stress && relevantTensile ? relevantTensile / stress : undefined;
    if (safetyFactor && safetyFactor < form.safetyFactor) critical.push("FS de triagem abaixo do alvo");
    const thermal = Math.min(25, Math.max(0, 15 + (spec.continuous - form.continuousTemp) * .18));
    const mechanical = Math.min(25, Math.max(0, spec.modulus / 400 + relevantTensile / 8));
    const environmental = Math.min(20, spec.uv * (form.uv.includes("Alta") ? 1.6 : .7) + spec.chemical * (form.chemical.includes("Nenhuma") ? .4 : 1));
    const process = Math.min(15, Math.max(0, 15 - (spec.processNozzleMin > 250 ? 4 : 0) - (spec.moisture < 3 ? 3 : 0)));
    const inventoryScore = stockGrams > 0 ? 8 : 0;
    const costScore = form.partMass > 0 ? Math.max(0, 7 - spec.costKg / 25) : 4;
    const sufficiencyPenalty = Math.max(0, (spec.continuous - form.continuousTemp - 80) / 10);
    const score = Math.round(Math.max(0, Math.min(100, thermal + mechanical + environmental + process + inventoryScore + costScore - sufficiencyPenalty + (form.preferStock && stockGrams > 0 ? 4 : 0))));
    if (critical.length) reasons.push(...critical.map((reason) => `Não recomendado: ${reason}.`));
    else reasons.push("Atende aos requisitos informados com margem adequada.");
    const status = critical.length ? "FAIL" : score >= 62 ? "PASS" : "MARGINAL";
    const cost = spec.costKg * form.partMass / 1000;
    return { ...spec, stockGrams, status, score, reasons, tradeoff: spec.name === "PA6-CF" ? "Maior rigidez e margem térmica, porém exige processo mais rigoroso e custo elevado." : "Boa suficiência e processo mais simples; a margem excedente é menor que em materiais de engenharia.", cost, stress, safetyFactor, confidence: Math.max(55, 94 - missing.length * 7 - (form.orientation === "Z" ? 5 : 0)) };
  });
  const ranked = candidates.filter((item) => item.status !== "FAIL").sort((a, b) => b.score - a.score);
  const rejected = candidates.filter((item) => item.status === "FAIL").sort((a, b) => b.score - a.score).slice(0, 2);
  return { primary: ranked[0] || null, alternatives: ranked.slice(1, 3), rejected, confidence: Math.max(35, Math.min(96, 94 - missing.length * 7)), missing, stress, deflection: stress ? (form.length * form.length * stress) / Math.max(1, (ranked[0]?.modulus || 1000) * Math.max(1, form.width * form.thickness)) : undefined, algorithmVersion: "material-selector-v3" };
}

export function applyPreset(form: SelectorForm, preset: string): SelectorForm {
  return { ...form, preset, ...(selectorPresets[preset] || {}) };
}
