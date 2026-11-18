import { useEffect, useRef, useState } from "react";
import type { CalendarEvent } from "../../lib/models";

export const HOUR_HEIGHT = 48;
const DEFAULT_MINUTES = 60;
const MIN_BLOCK_MINUTES = 20;

const hourFormatter = new Intl.DateTimeFormat("pt-BR", { hour: "numeric" });
const dayNameFormatter = new Intl.DateTimeFormat("pt-BR", { weekday: "short" });
const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
});

export function dayKey(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export type PlacedEvent = {
  event: CalendarEvent;
  startMin: number;
  endMin: number;
  lane: number;
  lanes: number;
};

/** Start (minutes from midnight) and length of a timed event. */
export function eventSpan(event: CalendarEvent) {
  const start = new Date(event.date);
  const startMin = start.getHours() * 60 + start.getMinutes();
  const length = Math.max(
    MIN_BLOCK_MINUTES,
    event.durationMinutes ?? DEFAULT_MINUTES
  );
  return { startMin, endMin: Math.min(1440, startMin + length) };
}

/** Places overlapping events side by side (greedy lane assignment per cluster). */
export function layoutDay(events: CalendarEvent[]): PlacedEvent[] {
  const items = events
    .map(event => ({ event, ...eventSpan(event) }))
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const placed: PlacedEvent[] = [];
  let cluster: PlacedEvent[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const lanes = Math.max(1, ...cluster.map(item => item.lane + 1));
    cluster.forEach(item => (item.lanes = lanes));
    placed.push(...cluster);
    cluster = [];
  };
  for (const item of items) {
    if (cluster.length && item.startMin >= clusterEnd) flush();
    const taken = new Set(
      cluster.filter(other => other.endMin > item.startMin).map(o => o.lane)
    );
    let lane = 0;
    while (taken.has(lane)) lane += 1;
    cluster.push({ ...item, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, item.endMin);
  }
  if (cluster.length) flush();
  return placed;
}

export function TimeGrid({
  days,
  timedByDay,
  allDayByDay,
  onSlot,
  onSelect,
}: {
  days: Date[];
  timedByDay: Map<string, CalendarEvent[]>;
  allDayByDay: Map<string, CalendarEvent[]>;
  onSlot: (date: Date) => void;
  onSelect: (event: CalendarEvent) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => new Date());
  const todayKey = dayKey(now);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const hour = Math.max(0, new Date().getHours() - 1);
    if (scroller.current)
      scroller.current.scrollTop = Math.min(hour, 7) * HOUR_HEIGHT;
  }, [days[0]?.getTime()]);

  const hours = Array.from({ length: 24 }, (_, hour) => hour);
  const hasAllDay = days.some(day => allDayByDay.get(dayKey(day))?.length);
  const style = { "--gcal-cols": days.length } as React.CSSProperties;

  return (
    <div className="gcal" style={style}>
      <div className="gcal-head">
        <div className="gcal-gutter" />
        {days.map(day => {
          const key = dayKey(day);
          return (
            <div
              key={key}
              className={`gcal-dayhead${key === todayKey ? " is-today" : ""}`}
            >
              <span className="gcal-dow">
                {dayNameFormatter.format(day).replace(".", "")}
              </span>
              <span className="gcal-dom">{day.getDate()}</span>
            </div>
          );
        })}
      </div>
      {hasAllDay && (
        <div className="gcal-allday">
          <div className="gcal-gutter">dia todo</div>
          {days.map(day => (
            <div key={dayKey(day)} className="gcal-allday-cell">
              {(allDayByDay.get(dayKey(day)) ?? []).map(event => (
                <button
                  type="button"
                  key={event.id}
                  className={`gcal-chip gcal-type-${event.type}`}
                  onClick={() => onSelect(event)}
                >
                  {event.title}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
      <div className="gcal-scroll" ref={scroller}>
        <div className="gcal-body" style={{ height: 24 * HOUR_HEIGHT }}>
          <div className="gcal-gutter">
            {hours.map(hour => (
              <span
                key={hour}
                className="gcal-hour"
                style={{ top: hour * HOUR_HEIGHT }}
              >
                {hour === 0
                  ? ""
                  : hourFormatter.format(new Date(2000, 0, 1, hour))}
              </span>
            ))}
          </div>
          {days.map(day => {
            const key = dayKey(day);
            const placed = layoutDay(timedByDay.get(key) ?? []);
            return (
              <div
                key={key}
                className={`gcal-col${key === todayKey ? " is-today" : ""}`}
                onClick={clickEvent => {
                  if (clickEvent.target !== clickEvent.currentTarget) return;
                  const rect = clickEvent.currentTarget.getBoundingClientRect();
                  const minutes =
                    Math.floor(
                      ((clickEvent.clientY - rect.top) / HOUR_HEIGHT) * 2
                    ) * 30;
                  const date = new Date(day);
                  date.setHours(0, minutes, 0, 0);
                  onSlot(date);
                }}
              >
                {hours.map(hour => (
                  <div
                    key={hour}
                    className="gcal-line"
                    style={{ top: hour * HOUR_HEIGHT }}
                  />
                ))}
                {placed.map(item => (
                  <button
                    type="button"
                    key={item.event.id}
                    className={`gcal-event gcal-type-${item.event.type}`}
                    style={{
                      top: (item.startMin / 60) * HOUR_HEIGHT,
                      height: Math.max(
                        18,
                        ((item.endMin - item.startMin) / 60) * HOUR_HEIGHT - 2
                      ),
                      left: `calc(${(item.lane / item.lanes) * 100}% + 1px)`,
                      width: `calc(${100 / item.lanes}% - 4px)`,
                    }}
                    onClick={() => onSelect(item.event)}
                    title={item.event.title}
                  >
                    <strong>{item.event.title}</strong>
                    <span>
                      {timeFormatter.format(new Date(item.event.date))}
                    </span>
                  </button>
                ))}
                {key === todayKey && (
                  <div
                    className="gcal-now"
                    style={{
                      top:
                        ((now.getHours() * 60 + now.getMinutes()) / 60) *
                        HOUR_HEIGHT,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
