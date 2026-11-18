import type { CalendarEvent } from "./models";

/** Events have no end time; Google Calendar and .ics files get a default length. */
export const DEFAULT_EVENT_MINUTES = 60;

const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
const pad = (value: number) => String(value).padStart(2, "0");

function utcStamp(date: Date) {
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function dayStamp(key: string, plusDays = 0) {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + plusDays));
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
}

/** Start/end in the format both Google Calendar and iCalendar understand. */
export function eventRange(event: CalendarEvent):
  | { allDay: true; start: string; end: string }
  | { allDay: false; start: string; end: string }
  | null {
  if (dateOnly.test(event.date)) {
    return {
      allDay: true,
      start: dayStamp(event.date),
      end: dayStamp(event.date, 1),
    };
  }
  const start = new Date(event.date);
  if (!Number.isFinite(start.getTime())) return null;
  if (event.allDay) {
    const key = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
    const days = Math.max(1, Math.ceil((event.durationMinutes ?? 1440) / 1440));
    return {
      allDay: true,
      start: dayStamp(key),
      end: dayStamp(key, days),
    };
  }
  const end = new Date(
    start.getTime() + (event.durationMinutes ?? DEFAULT_EVENT_MINUTES) * 60_000
  );
  return { allDay: false, start: utcStamp(start), end: utcStamp(end) };
}

/** Link that opens Google Calendar with the event already filled in. */
export function googleCalendarUrl(event: CalendarEvent): string | null {
  const range = eventRange(event);
  if (!range) return null;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${range.start}/${range.end}`,
    details: event.detail ?? "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function escapeText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

/** RFC 5545 folding: lines longer than 75 octets continue after CRLF + space. */
function fold(line: string) {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  for (const char of line) {
    const limit = parts.length === 0 ? 75 : 74;
    if (encoder.encode(current + char).length > limit) {
      parts.push(current);
      current = char;
    } else current += char;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export function buildIcs(events: CalendarEvent[], now = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Reverso Works//Gestor//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Reverso Works",
  ];
  for (const event of events) {
    const range = eventRange(event);
    if (!range) continue;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.id}@reversoworks.com`,
      `DTSTAMP:${utcStamp(now)}`,
      range.allDay
        ? `DTSTART;VALUE=DATE:${range.start}`
        : `DTSTART:${range.start}`,
      range.allDay ? `DTEND;VALUE=DATE:${range.end}` : `DTEND:${range.end}`,
      `SUMMARY:${escapeText(event.title)}`
    );
    if (event.detail) lines.push(`DESCRIPTION:${escapeText(event.detail)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function downloadIcs(events: CalendarEvent[], fileName = "reverso-works-agenda.ics") {
  const blob = new Blob([buildIcs(events)], {
    type: "text/calendar;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
