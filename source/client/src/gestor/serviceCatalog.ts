/** Canonical catalog approved on 2026-11-04. Prices are intentionally unset. */
export type ServiceCategory = "DET" | "PDR" | "FAR" | "P3D";
export type OfficialService = {
  code: string;
  name: string;
  description: string;
  category: ServiceCategory | null;
  type: "Principal" | "Add-on" | "Principal B2B" | "Pacote";
  price: null;
  active: true;
  /** Any one prerequisite is sufficient; all must belong to the same job. */
  prerequisites: string[];
  components: string[];
  alternatives?: string[];
};

export const serviceCategories: Record<ServiceCategory, string> = {
  DET: "Detailing & Paint Care",
  PDR: "Paintless Dent Removal",
  FAR: "Headlight Restoration",
  P3D: "3D Parts, OEM & Custom",
};

function service(
  code: string,
  name: string,
  description: string,
  category: ServiceCategory | null,
  type: OfficialService["type"],
  prerequisites: string[] = [],
  components: string[] = [],
  alternatives?: string[]
): OfficialService {
  return {
    code,
    name,
    description,
    category,
    type,
    price: null,
    active: true,
    prerequisites,
    components,
    ...(alternatives ? { alternatives } : {}),
  };
}

export const officialServices: OfficialService[] = [
  service(
    "DET-01",
    "Interior & Exterior Detailing",
    "Full detailing inside and out: deep cleaning, decontamination and finishing.",
    "DET",
    "Principal"
  ),
  service(
    "DET-02",
    "One-Step Paint Correction",
    "Machine polishing in a single stage: removes light swirls, haze and oxidation, restores gloss.",
    "DET",
    "Principal"
  ),
  service(
    "DET-03",
    "Paint Protection — Ceramic Spray Sealant",
    "Spray ceramic sealant applied after detailing/correction.",
    "DET",
    "Add-on",
    ["DET-01", "DET-02"]
  ),
  service(
    "DET-04",
    "Paint Protection — Ceramic Coating",
    "Full ceramic coating, premium protection, applied only on corrected paint.",
    "DET",
    "Add-on",
    ["DET-02"]
  ),
  service(
    "DET-05",
    "Trim & Plastic Restoration",
    "Faded exterior plastics and trim restored to a deep factory look.",
    "DET",
    "Add-on"
  ),
  service(
    "DET-06",
    "Engine Bay Detailing",
    "Engine bay degreased, cleaned and dressed.",
    "DET",
    "Add-on"
  ),
  service(
    "DET-07",
    "Water Spot Removal",
    "Mineral water spots removed from glass and paint.",
    "DET",
    "Add-on"
  ),
  service(
    "PDR-01",
    "Paintless Dent Removal",
    "Dents removed with no paint and no filler; original paint preserved. Orçado por painel/amassado.",
    "PDR",
    "Principal"
  ),
  service(
    "PDR-02",
    "Paint Chip & Scratch Touch-Up",
    "Touch-up of paint chips/scratches in the repaired area.",
    "PDR",
    "Add-on",
    ["PDR-01"]
  ),
  service(
    "PDR-03",
    "Localized Polishing",
    "Machine polishing of the repaired area so it blends with the panel.",
    "PDR",
    "Add-on",
    ["PDR-01"]
  ),
  service(
    "FAR-01",
    "Headlight Restoration",
    "Yellowed/cloudy headlights sanded and polished back to clear.",
    "FAR",
    "Principal"
  ),
  service(
    "FAR-02",
    "UV / Ceramic Headlight Protection",
    "UV/ceramic protection sealed on the restored lens to prevent re-yellowing.",
    "FAR",
    "Add-on",
    ["FAR-01"]
  ),
  service(
    "P3D-01",
    "Discontinued Part — OEM-Style Replacement",
    "A discontinued/unavailable part recreated: scan, CAD, prototype, final part.",
    "P3D",
    "Principal"
  ),
  service(
    "P3D-02",
    "Custom Part / Functional Adaptation",
    "A part designed from scratch for a project (adapters, mounts, one-off solutions).",
    "P3D",
    "Principal"
  ),
  service(
    "P3D-03",
    "OEM Finish (sanding, primer, texture, paint)",
    "Finishing that makes a printed part look and feel like a factory part.",
    "P3D",
    "Add-on",
    ["P3D-01", "P3D-02"]
  ),
  service(
    "P3D-04",
    "3D Scanning & CAD (B2B)",
    "Scanning and CAD design only, delivered as files to shops and builders.",
    "P3D",
    "Principal B2B"
  ),
  service(
    "P3D-05",
    "Broken Plastic Part Repair",
    "Broken plastic brackets, tabs, clips and covers repaired or recreated.",
    "P3D",
    "Principal"
  ),
  service(
    "P3D-06",
    "Part Installation",
    "Installation of the finished part on the vehicle.",
    "P3D",
    "Add-on",
    ["P3D-01", "P3D-02", "P3D-05"]
  ),
  service(
    "PCT-01",
    "Bring It Back",
    "DET-02 + DET-04 + DET-05 + FAR-01 + FAR-02",
    null,
    "Pacote",
    [],
    ["DET-02", "DET-04", "DET-05", "FAR-01", "FAR-02"]
  ),
  service(
    "PCT-02",
    "Dent + Detail",
    "PDR-01 + PDR-02 + DET-01",
    null,
    "Pacote",
    [],
    ["PDR-01", "PDR-02", "DET-01"]
  ),
  service(
    "PCT-03",
    "The Missing Part",
    "P3D-01 ou P3D-02 + P3D-03 + P3D-06",
    null,
    "Pacote",
    [],
    ["P3D-03", "P3D-06"],
    ["P3D-01", "P3D-02"]
  ),
];

// Runtime immutability prevents a consumer from turning this into a custom catalog.
Object.freeze(serviceCategories);
for (const item of officialServices) {
  Object.freeze(item.prerequisites);
  Object.freeze(item.components);
  if (item.alternatives) Object.freeze(item.alternatives);
  Object.freeze(item);
}
Object.freeze(officialServices);

export function findService(code: string): OfficialService | undefined {
  return officialServices.find(item => item.code === code);
}

export function expandService(code: string, alternative?: string): string[] {
  const item = findService(code);
  if (!item) throw new Error(`Serviço desconhecido: ${code}.`);
  if (item.alternatives) {
    if (!alternative || !item.alternatives.includes(alternative))
      throw new Error(
        `${code}: escolha explicitamente ${item.alternatives.join(" ou ")}.`
      );
    return [alternative, ...item.components];
  }
  if (alternative)
    throw new Error(`${code}: este serviço não possui alternativa.`);
  return item.type === "Pacote" ? [...item.components] : [code];
}

/** Only executable codes belong in a job; commercial package codes are expanded first. */
export function validateServiceCodes(codes: string[]): void {
  if (!Array.isArray(codes) || !codes.length)
    throw new Error("Selecione ao menos um serviço oficial.");
  for (const code of codes) {
    const item = findService(code);
    if (!item) throw new Error(`Serviço desconhecido: ${code}.`);
    if (item.type === "Pacote")
      throw new Error(`${code}: expanda o pacote em serviços individuais.`);
    if (
      item.prerequisites.length &&
      !item.prerequisites.some(required => codes.includes(required))
    )
      throw new Error(
        `${code}: pré-requisito obrigatório no mesmo job: ${item.prerequisites.join(" ou ")}.`
      );
  }
}

export function categoryForCodes(codes: string[]): ServiceCategory[] {
  const categories = new Set<ServiceCategory>();
  for (const code of codes) {
    const item = findService(code);
    if (!item) throw new Error(`Serviço desconhecido: ${code}.`);
    if (item.category) categories.add(item.category);
    else
      for (const child of [...item.components, ...(item.alternatives ?? [])]) {
        const category = findService(child)?.category;
        if (category) categories.add(category);
      }
  }
  return (Object.keys(serviceCategories) as ServiceCategory[]).filter(
    category => categories.has(category)
  );
}
