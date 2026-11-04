import type { OrderLine } from "../lib/models";
import { calculateOrderTotals, toCents } from "../lib/finance";
import type { JobWorkflow } from "./jobWorkflow";

type ChargeDocument = {
  lines: OrderLine[];
  taxRate?: number;
  workflow?: JobWorkflow;
  total?: number;
  totalCents?: number;
  subtotal?: number;
  subtotalCents?: number;
  tax?: number;
  taxCents?: number;
};
/** One monetary authority. A manually changed final charge is an explicit adjustment, not a rewritten quote. */
export function jobChargeTotals(order: ChargeDocument) {
  const calculated = calculateOrderTotals(order.lines, order.taxRate ?? 0);
  const quoteCents =
    order.workflow?.quotedAmount != null
      ? toCents(order.workflow.quotedAmount)
      : (order.totalCents ??
        (order.total != null ? toCents(order.total) : calculated.totalCents));
  const taxCents =
    order.taxCents ??
    (order.tax != null ? toCents(order.tax) : calculated.taxCents);
  const totalCents =
    order.workflow?.finalAmount != null
      ? toCents(order.workflow.finalAmount)
      : quoteCents;
  const adjustmentCents = totalCents - quoteCents;
  const subtotalCents = order.workflow
    ? totalCents - taxCents
    : (order.subtotalCents ??
      (order.subtotal != null
        ? toCents(order.subtotal)
        : calculated.subtotalCents));
  const pending =
    order.lines.some(line => line.pricePending) ||
    Boolean(order.workflow && order.workflow.quotedAmount === null);
  return {
    quoteCents,
    subtotalCents,
    taxCents,
    totalCents,
    adjustmentCents,
    pending,
  };
}
