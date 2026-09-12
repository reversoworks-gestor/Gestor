export type PricedLine = {
  quantity: number;
  unitPrice: number;
  unitPriceCents?: number;
  kind?: "item" | "service";
  taxable?: boolean;
};

export type OrderTotals = {
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
};

function decimalFraction(value: number | string) {
  const source = String(value).trim().toLowerCase();
  const match = source.match(/^([+-]?)(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/);
  if (!match || (!match[2] && !match[3])) return { numerator: 0n, denominator: 1n };
  const sign = match[1] === "-" ? -1n : 1n;
  const whole = match[2] || "0";
  const fraction = match[3] || "";
  const exponent = Number(match[4] || 0);
  const digits = BigInt(`${whole}${fraction}` || "0");
  const decimalPlaces = fraction.length - exponent;
  if (decimalPlaces <= 0) {
    return { numerator: sign * digits * (10n ** BigInt(-decimalPlaces)), denominator: 1n };
  }
  return { numerator: sign * digits, denominator: 10n ** BigInt(decimalPlaces) };
}

function roundDivision(numerator: bigint, denominator: bigint) {
  if (denominator <= 0n || numerator <= 0n) return 0n;
  return (numerator + denominator / 2n) / denominator;
}

export function toCents(value: number | string) {
  const parsed = decimalFraction(value);
  if (parsed.numerator < 0n) return 0;
  return Number(roundDivision(parsed.numerator * 100n, parsed.denominator));
}

export function multiplyDecimalsToCents(values: Array<number | string>) {
  let numerator = 1n;
  let denominator = 1n;
  for (const value of values) {
    const parsed = decimalFraction(value);
    if (parsed.numerator < 0n) return 0;
    numerator *= parsed.numerator;
    denominator *= parsed.denominator;
  }
  return Number(roundDivision(numerator * 100n, denominator));
}

export function calculateLineSubtotalCents(line: PricedLine) {
  const unitPriceCents = Number.isInteger(line.unitPriceCents)
    ? Math.max(0, line.unitPriceCents ?? 0)
    : toCents(line.unitPrice);
  const quantity = decimalFraction(Math.max(0, line.quantity));
  return Number(roundDivision(BigInt(unitPriceCents) * quantity.numerator, quantity.denominator));
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
  return multiplyDecimalsToCents([pricePerGram, weightGrams, hours, hourlyRate]);
}

export function calculateOrderTotals(lines: PricedLine[], taxRate = 0): OrderTotals {
  const subtotalCents = lines.reduce((sum, line) => sum + calculateLineSubtotalCents(line), 0);
  const taxableCents = lines.reduce(
    (sum, line) =>
      sum + (line.kind === "item" && line.taxable !== false
        ? calculateLineSubtotalCents(line)
        : 0),
    0,
  );
  const parsedRate = decimalFraction(Math.max(0, taxRate));
  const taxCents = Number(roundDivision(BigInt(taxableCents) * parsedRate.numerator, parsedRate.denominator));
  return { subtotalCents, taxCents, totalCents: subtotalCents + taxCents };
}

export function centsToAmount(cents: number) {
  return Math.round(cents) / 100;
}

export function sanitizeFileName(value: string) {
  return (value || "cliente").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "cliente";
}

export function validatePayments(totalCents: number, payments: Array<{ amount: number; amountCents?: number; method?: string; date?: string }>) {
  const amounts = payments.map((payment) => Number.isInteger(payment.amountCents) ? payment.amountCents! : toCents(payment.amount));
  if (payments.some((payment) => !Number.isFinite(payment.amount) || payment.amount < 0)) return "Pagamentos não podem ser negativos.";
  if (payments.some((payment) => payment.amountCents !== undefined && payment.amountCents < 0)) return "Pagamentos não podem ser negativos.";
  if (payments.some((payment) => !payment.method?.trim() || !payment.date)) return "Informe método e data em todos os pagamentos.";
  if (amounts.reduce((sum, amount) => sum + amount, 0) > totalCents) return "A soma dos pagamentos não pode exceder o total.";
  return null;
}
