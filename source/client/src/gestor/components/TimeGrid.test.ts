import { describe, expect, it } from "vitest";
import { layoutDay } from "./TimeGrid";

const at = (id: string, hour: number, minute = 0, durationMinutes = 60) => ({
  id,
  title: id,
  detail: "",
  type: "calendar" as const,
  date: new Date(2026, 10, 20, hour, minute).toISOString(),
  durationMinutes,
});

describe("layoutDay", () => {
  it("coloca eventos sobrepostos lado a lado", () => {
    const placed = layoutDay([at("a", 9), at("b", 9, 30), at("c", 11)]);
    const byId = Object.fromEntries(placed.map(p => [p.event.id, p]));
    expect(byId.a.lanes).toBe(2);
    expect(byId.b.lane).toBe(1);
    expect(byId.c.lanes).toBe(1);
    expect(byId.c.lane).toBe(0);
  });
  it("respeita a duração", () => {
    const [p] = layoutDay([at("a", 9, 0, 90)]);
    expect(p.endMin - p.startMin).toBe(90);
  });
});
