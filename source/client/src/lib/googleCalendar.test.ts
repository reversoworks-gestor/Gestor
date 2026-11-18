import { describe, expect, it } from "vitest";
import { buildIcs, googleCalendarUrl } from "./googleCalendar";

const timed = {
  id: "e1",
  title: "Avaliação, farol; Mustang",
  detail: "Linha 1\nLinha 2",
  date: "2026-11-20T18:30:00.000Z",
  type: "calendar" as const,
};
const allDay = { ...timed, id: "e2", date: "2026-11-21" };

describe("Google Agenda", () => {
  it("monta o link com título, horário em UTC e duração de 1h", () => {
    const url = new URL(googleCalendarUrl(timed)!);
    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("text")).toBe(timed.title);
    expect(url.searchParams.get("dates")).toBe("20261120T183000Z/20261120T193000Z");
  });
  it("trata evento só com data como dia inteiro", () => {
    const url = new URL(googleCalendarUrl(allDay)!);
    expect(url.searchParams.get("dates")).toBe("20261121/20261122");
  });
  it("ignora datas inválidas", () => {
    expect(googleCalendarUrl({ ...timed, date: "xx" })).toBeNull();
  });
  it("gera .ics válido com escape e quebra de linha CRLF", () => {
    const ics = buildIcs([timed, allDay], new Date("2026-11-18T12:00:00Z"));
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("UID:e1@reversoworks.com");
    expect(ics).toContain("DTSTART:20261120T183000Z");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261121");
    expect(ics).toContain("SUMMARY:Avaliação\\, farol\; Mustang");
    expect(ics).toContain("DESCRIPTION:Linha 1\\nLinha 2");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});
