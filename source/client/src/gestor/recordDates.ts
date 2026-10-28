type DatedRecord = { createdAt?: unknown; updatedAt?: unknown; id?: unknown };

/** Read-only adapter: numeric epoch values are milliseconds; Firestore seconds are explicit. */
export function timestampMillis(value: unknown): number | null {
  try {
    let milliseconds: number;
    if (value instanceof Date) milliseconds = value.getTime();
    else if (typeof value === "number") milliseconds = value;
    else if (typeof value === "string" && value.trim()) {
      const text = value.trim();
      milliseconds = /^-?\d+(?:\.\d+)?$/.test(text)
        ? Number(text)
        : Date.parse(text);
    } else if (value && typeof value === "object") {
      const timestamp = value as {
        toMillis?: () => number;
        toDate?: () => Date;
        seconds?: number;
        nanoseconds?: number;
        _seconds?: number;
        _nanoseconds?: number;
      };
      if (typeof timestamp.toMillis === "function")
        milliseconds = timestamp.toMillis();
      else if (typeof timestamp.toDate === "function")
        milliseconds = timestamp.toDate().getTime();
      else {
        const seconds = timestamp.seconds ?? timestamp._seconds;
        const nanoseconds =
          timestamp.nanoseconds ?? timestamp._nanoseconds ?? 0;
        if (
          typeof seconds !== "number" ||
          typeof nanoseconds !== "number" ||
          !Number.isFinite(seconds) ||
          !Number.isFinite(nanoseconds) ||
          nanoseconds < 0 ||
          nanoseconds >= 1e9
        )
          return null;
        milliseconds = seconds * 1000 + nanoseconds / 1e6;
      }
    } else return null;
    return Number.isFinite(milliseconds) &&
      Number.isFinite(new Date(milliseconds).getTime())
      ? milliseconds
      : null;
  } catch {
    return null;
  }
}

export function timestampIso(value: unknown): string | undefined {
  const milliseconds = timestampMillis(value);
  return milliseconds === null
    ? undefined
    : new Date(milliseconds).toISOString();
}

export function newestFirst(left: DatedRecord, right: DatedRecord): number {
  const a = timestampMillis(left.updatedAt) ?? timestampMillis(left.createdAt);
  const b =
    timestampMillis(right.updatedAt) ?? timestampMillis(right.createdAt);
  if (a === null && b !== null) return 1;
  if (b === null && a !== null) return -1;
  const difference = a !== null && b !== null ? b - a : 0;
  return (
    difference || String(left.id ?? "").localeCompare(String(right.id ?? ""))
  );
}
