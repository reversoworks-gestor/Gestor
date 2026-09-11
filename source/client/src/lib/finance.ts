export type PricedLine = {
  quantity: number;
  unitPrice: number;
  kind?: "item" | "service";
  taxable?: boolean;
};

export type OrderTotals = {
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
};

function toCents(value: number) {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.round(value * 100);
}

export function printServicePrice({
  pricePerGram,
  weightGrams,
  hours,
  hourlyRate = 2.5,
}: {
  pricePerGram: number;
  weightGrams: number;
  hours: number;
  hourlyRate?: number;
}) {
  return toCents(pricePerGram * weightGrams * (hours * hourlyRate));
}

export function calculateOrderTotals(lines: PricedLine[], taxRate = 0): OrderTotals {
  const subtotalCents = lines.reduce(
    (sum, line) => sum + Math.round(toCents(line.unitPrice) * Math.max(0, line.quantity)),
    0,
  );
  const taxableCents = lines.reduce(
    (sum, line) =>
      sum + (line.kind === "item" && line.taxable !== false
        ? Math.round(toCents(line.unitPrice) * Math.max(0, line.quantity))
        : 0),
    0,
  );
  const taxCents = Math.round(taxableCents * Math.max(0, taxRate));
  return { subtotalCents, taxCents, totalCents: subtotalCents + taxCents };
}

export function centsToAmount(cents: number) {
  return Math.round(cents) / 100;
}

export function sanitizeFileName(value: string) {
  return (value || "cliente").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "cliente";
}

export function validatePayments(totalCents: number, payments: Array<{ amount: number }>) {
  const amounts = payments.map((payment) => toCents(payment.amount));
  if (payments.some((payment) => !Number.isFinite(payment.amount) || payment.amount < 0)) return "Pagamentos não podem ser negativos.";
  if (amounts.reduce((sum, amount) => sum + amount, 0) > totalCents) return "A soma dos pagamentos não pode exceder o total.";
  return null;
}
