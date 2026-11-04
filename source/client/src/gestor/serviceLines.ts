import type { OrderLine } from "../lib/models";
import { makeId } from "./types";
import {
  expandService,
  findService,
  validateServiceCodes,
} from "./serviceCatalog";

export function addOfficialLines(
  existing: OrderLine[],
  code: string,
  alternative?: string
): OrderLine[] {
  const selected = findService(code);
  if (!selected) throw new Error("Selecione um código do catálogo oficial.");
  const codes = expandService(code, alternative);
  const existingCodes = existing
    .map(line => line.serviceCode)
    .filter((code): code is string => Boolean(code));
  validateServiceCodes([...existingCodes, ...codes]);
  if (
    selected.type === "Pacote" &&
    existing.some(line => line.packageCode && line.packageCode !== code)
  )
    throw new Error(
      "O job já possui um pacote associado. Mantenha o pacote atual ou componha os serviços individuais em outro job."
    );
  const result = existing.map(line =>
    selected.type === "Pacote" && codes.includes(line.serviceCode ?? "")
      ? { ...line, packageCode: code }
      : { ...line }
  );
  for (const serviceCode of codes) {
    if (result.some(line => line.serviceCode === serviceCode)) continue;
    const service = findService(serviceCode)!;
    result.push({
      id: makeId("line"),
      service: "custom",
      kind: "service",
      taxable: false,
      serviceCode,
      packageCode: selected.type === "Pacote" ? code : undefined,
      catalogItemId: serviceCode,
      label: service.name,
      description: service.description,
      quantity: 1,
      unit: "unidades",
      unitPrice: 0,
      unitPriceCents: 0,
      pricePending: true,
    });
  }
  return result;
}
export function pendingPricing(lines: OrderLine[]) {
  return lines.some(line => line.pricePending);
}
