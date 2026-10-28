/** Formats a valid Date as a local datetime-local value (never converts through UTC).
 * Returns null for an invalid Date. Seconds and milliseconds are kept only when non-zero.
 */
export function formatDateTimeLocal(date: Date): string | null {
  if (!Number.isFinite(date.getTime())) return null;

  const pad = (value: number, width = 2) => String(value).padStart(width, "0");
  const datePart = `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  let timePart = `${pad(date.getHours())}:${pad(date.getMinutes())}`;

  if (date.getSeconds() !== 0 || date.getMilliseconds() !== 0) {
    timePart += `:${pad(date.getSeconds())}`;
    if (date.getMilliseconds() !== 0) timePart += `.${pad(date.getMilliseconds(), 3)}`;
  }

  return `${datePart}T${timePart}`;
}

export type StockDirection = "in" | "out";
export type StockMovementError = "invalid-balance" | "invalid-quantity" | "insufficient-stock";
export type StockMovementResult =
  | { ok: true; balance: number; quantity: number }
  | { ok: false; error: StockMovementError };

/** Applies an exact positive movement; a balance may be zero but must be finite and non-negative.
 * An outbound quantity above the balance fails explicitly and is never clamped or logged differently.
 */
export function moveStock(balance: number, quantity: number, direction: StockDirection): StockMovementResult {
  if (!Number.isFinite(balance) || balance < 0) return { ok: false, error: "invalid-balance" };
  if (!Number.isFinite(quantity) || quantity <= 0) return { ok: false, error: "invalid-quantity" };

  if (direction === "out" && quantity > balance) return { ok: false, error: "insufficient-stock" };
  return {
    ok: true,
    balance: direction === "in" ? balance + quantity : balance - quantity,
    quantity,
  };
}

export type Reservation = Readonly<{ materialId: string; quantity: number }>;
export type ReservationError = "invalid-reservation" | "missing-stock" | "invalid-stock" | "insufficient-stock";
export type ReservationResult =
  | { ok: true; balances: Record<string, number>; released: Reservation | null; reserved: Reservation | null }
  | { ok: false; error: ReservationError };

/** Returns the previous reservation to its material, then debits the replacement.
 * Inputs are never mutated; failures return no candidate balances, so callers cannot apply a partial update.
 * Every referenced material must have a finite, non-negative balance; reservation quantities must be finite and positive.
 */
export function reconcileReservation(
  balances: Readonly<Record<string, number>>,
  previous: Reservation | null,
  next: Reservation | null,
): ReservationResult {
  const reservations = [previous, next];
  for (const reservation of reservations) {
    if (reservation && (!reservation.materialId.trim() || !Number.isFinite(reservation.quantity) || reservation.quantity <= 0)) {
      return { ok: false, error: "invalid-reservation" };
    }
  }

  const referencedMaterials = new Set(reservations.flatMap((reservation) => reservation ? [reservation.materialId] : []));
  for (const materialId of referencedMaterials) {
    if (!Object.prototype.hasOwnProperty.call(balances, materialId)) return { ok: false, error: "missing-stock" };
    if (!Number.isFinite(balances[materialId]) || balances[materialId] < 0) return { ok: false, error: "invalid-stock" };
  }

  const updated = { ...balances };
  if (previous) {
    const returnedBalance = updated[previous.materialId] + previous.quantity;
    if (!Number.isFinite(returnedBalance)) return { ok: false, error: "invalid-stock" };
    updated[previous.materialId] = returnedBalance;
  }

  if (next) {
    if (updated[next.materialId] < next.quantity) return { ok: false, error: "insufficient-stock" };
    updated[next.materialId] -= next.quantity;
  }

  return { ok: true, balances: updated, released: previous, reserved: next };
}

export type PrintSettings = Readonly<{ walls: number; infillPercent: number }>;
export type PrintSettingsError =
  | "invalid-format"
  | "invalid-walls"
  | "walls-out-of-range"
  | "invalid-infill"
  | "infill-out-of-range";
export type PrintSettingsResult =
  | { ok: true; value: PrintSettings }
  | { ok: false; error: PrintSettingsError };

/** Parses `walls / infill%`; walls must be an integer in 1..20 and infill in 0..100. */
export function parseWallsAndInfill(input: string): PrintSettingsResult {
  const match = /^\s*([^/]+)\s*\/\s*([^%]+)\s*%\s*$/.exec(input);
  if (!match) return { ok: false, error: "invalid-format" };

  const walls = Number(match[1].trim());
  if (!Number.isFinite(walls) || !Number.isInteger(walls)) return { ok: false, error: "invalid-walls" };
  if (walls < 1 || walls > 20) return { ok: false, error: "walls-out-of-range" };

  const infillText = match[2].trim();
  const infillPercent = Number(infillText.replace(",", "."));
  if (!infillText || !Number.isFinite(infillPercent)) return { ok: false, error: "invalid-infill" };
  if (infillPercent < 0 || infillPercent > 100) return { ok: false, error: "infill-out-of-range" };

  return { ok: true, value: { walls, infillPercent } };
}

/** Accepts a simple unquoted email form with a dotted domain and alphabetic TLD; whitespace is forbidden. */
export function isValidEmail(email: string): boolean {
  if (!email || email.length > 254 || /\s/.test(email)) return false;
  const at = email.indexOf("@");
  if (at <= 0 || at !== email.lastIndexOf("@")) return false;

  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (local.length > 64 || local.startsWith(".") || local.endsWith(".") || local.includes("..")) return false;
  if (!/^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local)) return false;

  const labels = domain.split(".");
  if (labels.length < 2 || labels.some((label) => !label || label.length > 63)) return false;
  if (labels.some((label) => !/^[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?$/i.test(label))) return false;
  return /^[A-Z]{2,}$/i.test(labels[labels.length - 1]);
}
