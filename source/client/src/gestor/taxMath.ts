import type { TaxEntry } from "./types";

/** Vencimentos federais usuais de impostos estimados (mudam em fim de semana/feriado). */
export function estimatedDueDates(year: number) {
  return [
    { quarter: 1 as const, date: `${year}-04-15` },
    { quarter: 2 as const, date: `${year}-06-15` },
    { quarter: 3 as const, date: `${year}-09-15` },
    { quarter: 4 as const, date: `${year + 1}-01-15` },
  ];
}
export function paidEstimated(
  entries: TaxEntry[],
  year: number,
  quarter: number,
  agency: "Federal" | "Califórnia"
) {
  return entries
    .filter(
      e =>
        e.kind === "estimated" &&
        e.date.slice(0, 4) === String(year) &&
        e.quarter === quarter &&
        e.agency === agency
    )
    .reduce((sum, e) => sum + (e.amountCents ?? 0), 0);
}
export function mileageTotals(entries: TaxEntry[], year: number, rate = 0) {
  const miles = entries
    .filter(e => e.kind === "mileage" && e.date.slice(0, 4) === String(year))
    .reduce((sum, e) => sum + (e.miles ?? 0), 0);
  return {
    miles: Math.round(miles * 10) / 10,
    deductionCents: rate > 0 ? Math.round(miles * rate * 100) : 0,
  };
}
/** Método simplificado do IRS: US$ 5 por pé² até 300 pés². Confirmar elegibilidade com o contador. */
export function homeOfficeDeductionCents(sqft = 0) {
  return Math.round(Math.min(Math.max(sqft, 0), 300) * 5 * 100);
}
