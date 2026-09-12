import type { Client, Expense, Order, OrderLine, Part, PartRevision, Payment } from "./models";
import { calculateOrderTotals, centsToAmount, toCents } from "./finance";

export function isEstimate(order: Order) {
  return order.documentType === "Estimativa" || order.documentType === "Orçamento";
}

export function normalizeLineMoney(line: OrderLine): OrderLine {
  const unitPriceCents = Number.isInteger(line.unitPriceCents)
    ? Math.max(0, line.unitPriceCents ?? 0)
    : toCents(line.unitPrice);
  return {
    ...line,
    kind: line.kind ?? "service",
    taxable: line.kind === "item" ? line.taxable !== false : false,
    unit: line.kind === "item" ? "unidades" : "horas",
    unitPriceCents,
    unitPrice: centsToAmount(unitPriceCents),
  };
}

export function normalizePaymentMoney(payment: Payment): Payment {
  const amountCents = Number.isInteger(payment.amountCents)
    ? Math.max(0, payment.amountCents ?? 0)
    : toCents(payment.amount);
  return { ...payment, amountCents, amount: centsToAmount(amountCents) };
}

export function normalizeOrderMoney(order: Order): Order {
  const lines = order.lines.map(normalizeLineMoney);
  const payments = (order.payments ?? []).map(normalizePaymentMoney);
  const totals = calculateOrderTotals(lines, order.taxRate ?? 0);
  return {
    ...order,
    documentType: isEstimate(order) ? "Estimativa" : "Invoice",
    lines,
    payments,
    subtotalCents: totals.subtotalCents,
    subtotal: centsToAmount(totals.subtotalCents),
    taxCents: totals.taxCents,
    tax: centsToAmount(totals.taxCents),
    totalCents: totals.totalCents,
    total: centsToAmount(totals.totalCents),
  };
}

export function createInvoiceFromEstimate(estimate: Order, invoiceId: string, timestamp: string): { estimate: Order; invoice: Order } {
  const normalized = normalizeOrderMoney(estimate);
  const invoice: Order = {
    ...normalized,
    id: invoiceId,
    documentType: "Invoice",
    status: "Rascunho",
    sourceEstimateId: estimate.id,
    invoiceId: undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  return {
    estimate: { ...normalized, invoiceId, updatedAt: timestamp },
    invoice,
  };
}

export function nextFutureOrder(orders: Order[], today = new Date()) {
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  return orders
    .filter((order) => order.dueDate && !["Aprovado"].includes(order.status))
    .filter((order) => {
      const due = new Date(`${order.dueDate}T00:00:00`);
      return !Number.isNaN(due.getTime()) && due >= start;
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
}

export type UnifiedSearchResult =
  | { kind: "client"; id: string; label: string; detail: string; record: Client }
  | { kind: "estimate" | "invoice"; id: string; label: string; detail: string; record: Order };

function searchText(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
}

export function unifiedSearch(term: string, clients: Client[], orders: Order[]): UnifiedSearchResult[] {
  const query = searchText(term.trim());
  if (query.length < 2) return [];
  const clientResults: UnifiedSearchResult[] = clients
    .filter((client) => searchText(`${client.name} ${client.firstName ?? ""} ${client.lastName ?? ""} ${client.email} ${client.phone} ${client.company}`).includes(query))
    .map((record) => ({ kind: "client", id: record.id, label: record.name, detail: record.email || record.phone, record }));
  const orderResults: UnifiedSearchResult[] = orders
    .filter((order) => searchText(`${order.title} ${order.clientName} ${order.documentType} ${order.id}`).includes(query))
    .map((record) => ({ kind: isEstimate(record) ? "estimate" : "invoice", id: record.id, label: record.title, detail: `${record.documentType} · ${record.clientName}`, record }));
  return [...orderResults, ...clientResults].slice(0, 12);
}

export function normalizeExpense(expense: Expense): Expense {
  const amountCents = Number.isInteger(expense.amountCents) ? expense.amountCents : toCents(expense.amount);
  return { ...expense, amountCents, amount: centsToAmount(amountCents) };
}

export function relatedRevisions(part: Part, revisions: PartRevision[]) {
  return revisions.filter((revision) => revision.partId === part.id);
}
