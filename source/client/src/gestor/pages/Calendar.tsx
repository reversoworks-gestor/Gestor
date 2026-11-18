import { DateInput } from "../components/ui";
import { useMemo, useRef, useState } from "react";
import { TimeGrid, dayKey } from "../components/TimeGrid";
import {
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Download,
  List,
  Plus,
  Search,
} from "lucide-react";
import type { CalendarEvent } from "../../lib/models";
import { downloadIcs, googleCalendarUrl } from "../../lib/googleCalendar";
import { useGestor } from "../store";
import { makeId } from "../types";
import {
  Badge,
  Button,
  ConfirmButton,
  EmptyState,
  Field,
  FormModal,
  PageHeading,
} from "../components/ui";

type CalendarView = "day" | "week" | "month" | "list";
type EventType = CalendarEvent["type"];
type CategoryFilter = EventType | "all";
type LocalDateTime = { date: string; time: string };
type EventDraft = LocalDateTime &
  Pick<CalendarEvent, "id" | "title" | "detail" | "type"> & {
    duration: number;
    allDay: boolean;
  };
type Editor = { draft: EventDraft; isNew: boolean };

const eventTypes: Array<{
  value: EventType;
  label: string;
  tone: "gold" | "success" | "warning" | "danger" | "neutral";
}> = [
  { value: "calendar", label: "Agenda", tone: "gold" },
  { value: "order", label: "Pedido", tone: "success" },
  { value: "triage", label: "Triagem", tone: "warning" },
  { value: "inventory", label: "Estoque", tone: "neutral" },
  { value: "maintenance", label: "Manutenção", tone: "danger" },
];

const typeMeta = Object.fromEntries(
  eventTypes.map(item => [item.value, item])
) as Record<EventType, (typeof eventTypes)[number]>;
const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const timePattern = /^(\d{2}):(\d{2})$/;
const localDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium",
});
const localDateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium",
  timeStyle: "short",
});
const monthFormatter = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
});
const weekdayFormatter = new Intl.DateTimeFormat("pt-BR", { weekday: "short" });

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function isValidLocalDate(value: string) {
  const match = datePattern.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (
    year < 1900 ||
    year > 2100 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  )
    return false;
  const candidate = new Date(year, month - 1, day);
  return (
    candidate.getFullYear() === year &&
    candidate.getMonth() === month - 1 &&
    candidate.getDate() === day
  );
}

function isValidLocalTime(value: string) {
  const match = timePattern.exec(value);
  if (!match) return false;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

/**
 * Stores an instant as ISO, while treating the values entered in the form as a
 * local date and local time. Values remain strings until this point so an
 * incomplete native input is never turned into an invalid, shifted date.
 */
function localDateTimeToIso({ date, time }: LocalDateTime) {
  if (!isValidLocalDate(date))
    throw new Error("Informe uma data válida, com ano entre 1900 e 2100.");
  if (!isValidLocalTime(time))
    throw new Error("Informe uma hora válida no formato HH:MM.");

  const [, yearText, monthText, dayText] = datePattern.exec(date)!;
  const [, hourText, minuteText] = timePattern.exec(time)!;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const local = new Date(year, month - 1, day, hour, minute, 0, 0);

  // A local wall-clock time may not exist when daylight-saving rules change.
  if (
    local.getFullYear() !== year ||
    local.getMonth() !== month - 1 ||
    local.getDate() !== day ||
    local.getHours() !== hour ||
    local.getMinutes() !== minute
  ) {
    throw new Error(
      "A data e a hora informadas não existem no fuso local. Escolha outro horário."
    );
  }

  return local.toISOString();
}

function eventLocalDateTime(value: string): LocalDateTime {
  if (datePattern.test(value)) return { date: value, time: "" };
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return { date: "", time: "" };
  return {
    date: localDateKey(parsed),
    time: `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`,
  };
}

function eventDayKey(event: CalendarEvent) {
  if (datePattern.test(event.date)) return event.date;
  const parsed = new Date(event.date);
  return Number.isFinite(parsed.getTime()) ? localDateKey(parsed) : "";
}

function eventTimestamp(event: CalendarEvent) {
  if (datePattern.test(event.date)) {
    const [year, month, day] = event.date.split("-").map(Number);
    return new Date(year, month - 1, day).getTime();
  }
  const timestamp = new Date(event.date).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
}

function formatEventDateTime(event: CalendarEvent) {
  if (datePattern.test(event.date)) {
    const [year, month, day] = event.date.split("-").map(Number);
    return `${localDateFormatter.format(new Date(year, month - 1, day))} · Sem horário`;
  }
  const parsed = new Date(event.date);
  return Number.isFinite(parsed.getTime())
    ? localDateTimeFormatter.format(parsed)
    : "Data inválida";
}

function makeDraft(event: CalendarEvent): EventDraft {
  const local = eventLocalDateTime(event.date);
  const legacyAllDay = datePattern.test(event.date);
  return {
    id: event.id,
    title: event.title,
    detail: event.detail,
    type: event.type,
    date: local.date,
    time: local.time || "09:00",
    duration: event.durationMinutes ?? 60,
    allDay: Boolean(event.allDay) || legacyAllDay,
  };
}

function makeNewDraft(seedDate: Date = new Date()): EventDraft {
  const next = new Date(seedDate);
  next.setSeconds(0, 0);
  next.setMinutes(Math.ceil(next.getMinutes() / 15) * 15);

  return {
    id: makeId("event"),
    title: "",
    detail: "",
    type: "calendar",
    date: localDateKey(next),
    time: `${pad(next.getHours())}:${pad(next.getMinutes())}`,
    duration: 60,
    allDay: false,
  };
}

function toCalendarEvent(draft: EventDraft): CalendarEvent {
  const title = draft.title.trim();
  if (!title) throw new Error("Informe um título para o evento.");
  const event: CalendarEvent = {
    id: draft.id,
    title,
    detail: draft.detail.trim(),
    type: draft.type,
    date: localDateTimeToIso({
      date: draft.date,
      time: draft.allDay ? "00:00" : draft.time,
    }),
  };
  if (draft.allDay) {
    event.allDay = true;
  } else {
    event.durationMinutes = draft.duration;
  }
  return event;
}

function toCalendarEventSafe(draft: EventDraft): CalendarEvent | null {
  try {
    return toCalendarEvent(draft);
  } catch {
    return null;
  }
}

function eventMatchesSearch(event: CalendarEvent, term: string) {
  const normalizedTerm = term.trim().toLocaleLowerCase("pt-BR");
  if (!normalizedTerm) return true;
  return [event.title, event.detail, typeMeta[event.type]?.label ?? event.type]
    .join(" ")
    .toLocaleLowerCase("pt-BR")
    .includes(normalizedTerm);
}

function MonthGrid({
  month,
  eventsByDay,
  onAdd,
  onSelect,
}: {
  month: Date;
  eventsByDay: Map<string, CalendarEvent[]>;
  onAdd: (date: Date) => void;
  onSelect: (event: CalendarEvent) => void;
}) {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const dayOffset = firstDay.getDay();
  const daysInMonth = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0
  ).getDate();
  const cellCount = Math.ceil((dayOffset + daysInMonth) / 7) * 7;
  const todayKey = localDateKey(new Date());
  const weekdays = Array.from({ length: 7 }, (_, index) =>
    weekdayFormatter.format(new Date(2023, 0, index + 1))
  );

  return (
    <section aria-label={`Calendário de ${monthFormatter.format(month)}`}>
      <div className="calendar-weekdays" aria-hidden="true">
        {weekdays.map((weekday, index) => (
          <span key={`${weekday}-${index}`}>{weekday.replace(".", "")}</span>
        ))}
      </div>
      <ol className="calendar-grid">
        {Array.from({ length: cellCount }, (_, index) => {
          const dayNumber = index - dayOffset + 1;
          const isInMonth = dayNumber >= 1 && dayNumber <= daysInMonth;
          const date = new Date(
            month.getFullYear(),
            month.getMonth(),
            dayNumber
          );
          const dateKey = localDateKey(date);
          const dayEvents = isInMonth ? (eventsByDay.get(dateKey) ?? []) : [];
          const label = new Intl.DateTimeFormat("pt-BR", {
            dateStyle: "full",
          }).format(date);

          return (
            <li
              key={dateKey}
              className={`calendar-day${isInMonth ? "" : " calendar-day-outside"}${dateKey === todayKey ? " calendar-day-today" : ""}`}
            >
              <Button
                variant="ghost"
                className="calendar-day-number"
                aria-label={`Adicionar evento em ${label}`}
                title={`Adicionar evento em ${label}`}
                onClick={() => onAdd(date)}
              >
                {date.getDate()}
              </Button>
              <div className="calendar-day-events">
                {dayEvents.map(event => {
                  const meta = typeMeta[event.type];
                  return (
                    <button
                      type="button"
                      className="calendar-event"
                      key={event.id}
                      onClick={() => onSelect(event)}
                      aria-label={`${event.title}, ${meta?.label ?? "Evento"}, ${formatEventDateTime(event)}`}
                      title={`${event.title} — ${formatEventDateTime(event)}`}
                    >
                      <span
                        className={`calendar-event-dot calendar-event-${event.type}`}
                        aria-hidden="true"
                      />
                      <span>{event.title}</span>
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function EventList({
  events,
  onSelect,
  onCreate,
}: {
  events: CalendarEvent[];
  onSelect: (event: CalendarEvent) => void;
  onCreate: () => void;
}) {
  if (!events.length) {
    return (
      <EmptyState
        title="Nenhum evento neste período"
        description="Ajuste os filtros ou registre um compromisso operacional."
        action={
          <Button variant="primary" onClick={onCreate}>
            <Plus size={18} /> Novo evento
          </Button>
        }
      />
    );
  }

  return (
    <ul className="list" aria-label="Eventos do período">
      {events.map(event => {
        const meta = typeMeta[event.type];
        return (
          <li key={event.id}>
            <button
              type="button"
              className="list-row calendar-list-row"
              onClick={() => onSelect(event)}
            >
              <div>
                <strong>{event.title}</strong>
                <p className="muted">
                  {event.detail || "Sem detalhes registrados."}
                </p>
              </div>
              <div className="calendar-list-meta">
                <Badge tone={meta?.tone ?? "neutral"}>
                  {meta?.label ?? "Evento"}
                </Badge>
                <time dateTime={event.date}>{formatEventDateTime(event)}</time>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default function CalendarPage() {
  const {
    data,
    loading,
    error,
    retry,
    save,
    remove,
    notify,
    search,
    setSearch,
  } = useGestor();
  const [view, setView] = useState<CalendarView>(() =>
    typeof window !== "undefined" && window.innerWidth < 700 ? "day" : "week"
  );
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [cursor, setCursor] = useState(() => new Date());
  const [editor, setEditor] = useState<Editor | null>(null);

  const filteredEvents = useMemo(() => {
    return [...data.calendar]
      .filter(
        event =>
          (category === "all" || event.type === category) &&
          eventMatchesSearch(event, search)
      )
      .sort((left, right) => eventTimestamp(left) - eventTimestamp(right));
  }, [category, data.calendar, search]);

  const weekDays = useMemo(() => {
    const start = new Date(
      cursor.getFullYear(),
      cursor.getMonth(),
      cursor.getDate() - cursor.getDay()
    );
    return Array.from(
      { length: 7 },
      (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    );
  }, [cursor]);
  const visibleMonth = useMemo(() => startOfMonth(cursor), [cursor]);
  const gridDays = view === "day" ? [new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate())] : weekDays;

  const monthEvents = useMemo(() => {
    return filteredEvents.filter(event => {
      const key = eventDayKey(event);
      return key.startsWith(
        `${visibleMonth.getFullYear()}-${pad(visibleMonth.getMonth() + 1)}-`
      );
    });
  }, [filteredEvents, visibleMonth]);

  const eventsByDay = useMemo(() => {
    const grouped = new Map<string, CalendarEvent[]>();
    monthEvents.forEach(event => {
      const key = eventDayKey(event);
      if (!key) return;
      grouped.set(key, [...(grouped.get(key) ?? []), event]);
    });
    return grouped;
  }, [monthEvents]);

  const { timedByDay, allDayByDay } = useMemo(() => {
    const timed = new Map<string, CalendarEvent[]>();
    const allDay = new Map<string, CalendarEvent[]>();
    filteredEvents.forEach(event => {
      const key = eventDayKey(event);
      if (!key) return;
      const target = event.allDay || datePattern.test(event.date) ? allDay : timed;
      target.set(key, [...(target.get(key) ?? []), event]);
    });
    return { timedByDay: timed, allDayByDay: allDay };
  }, [filteredEvents]);

  const listEvents = useMemo(() => {
    if (view !== "list") return [];
    return monthEvents;
  }, [monthEvents, view]);

  const touchStart = useRef<{ x: number; y: number } | null>(null);
  function onTouchStart(event: React.TouchEvent) {
    const touch = event.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  }
  function onTouchEnd(event: React.TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    step(dx < 0 ? 1 : -1);
  }

  function step(direction: -1 | 1) {
    setCursor(current => {
      if (view === "day")
        return new Date(current.getFullYear(), current.getMonth(), current.getDate() + direction);
      if (view === "week")
        return new Date(current.getFullYear(), current.getMonth(), current.getDate() + 7 * direction);
      return new Date(current.getFullYear(), current.getMonth() + direction, 1);
    });
  }

  const periodTitle =
    view === "day"
      ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(cursor)
      : view === "week"
        ? weekDays[0].getMonth() === weekDays[6].getMonth()
          ? monthFormatter.format(weekDays[0])
          : `${new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(weekDays[0])} – ${monthFormatter.format(weekDays[6])}`
        : monthFormatter.format(visibleMonth);

  function openNewEvent(date?: Date) {
    setEditor({ draft: makeNewDraft(date), isNew: true });
  }

  function openExistingEvent(event: CalendarEvent) {
    setEditor({ draft: makeDraft(event), isNew: false });
  }

  function updateDraft(patch: Partial<EventDraft>) {
    setEditor(current =>
      current ? { ...current, draft: { ...current.draft, ...patch } } : current
    );
  }

  async function saveEditor() {
    if (!editor) return;
    const event = toCalendarEvent(editor.draft);
    await save("calendar", event);
    notify(
      editor.isNew ? "Evento adicionado ao calendário." : "Evento atualizado.",
      "success"
    );
  }

  async function deleteEditor() {
    if (!editor || editor.isNew) return;
    await remove("calendar", editor.draft.id);
    notify("Evento removido do calendário.", "success");
    setEditor(null);
  }


  return (
    <main className="stack">
      <PageHeading
        eyebrow="Planejamento operacional"
        title="Calendário"
      />

      {error && (
        <div className="error-message" role="alert">
          <span>Não foi possível carregar os dados do calendário: {error}</span>
          <Button variant="secondary" onClick={retry}>
            Tentar novamente
          </Button>
        </div>
      )}

      <section className="gcal-toolbar" aria-label="Controles do calendário">
        <div className="gcal-nav">
          <Button variant="secondary" onClick={() => setCursor(new Date())}>
            Hoje
          </Button>
          <Button variant="ghost" aria-label="Período anterior" onClick={() => step(-1)}>
            <ChevronLeft size={20} />
          </Button>
          <Button variant="ghost" aria-label="Próximo período" onClick={() => step(1)}>
            <ChevronRight size={20} />
          </Button>
          <h2 className="gcal-title">{periodTitle}</h2>
        </div>
        <div className="gcal-views" role="tablist" aria-label="Visualização do calendário">
          {(
            [
              ["day", "Dia"],
              ["week", "Semana"],
            ] as const
          ).map(([value, label]) => (
            <button
              type="button"
              key={value}
              role="tab"
              aria-selected={view === value}
              className={view === value ? "is-active" : ""}
              onClick={() => setView(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="gcal-filters">
          <span className="calendar-search-input">
            <Search size={18} aria-hidden="true" />
            <input
              aria-label="Buscar eventos"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Buscar eventos"
            />
          </span>
          <select
            aria-label="Categoria"
            value={category}
            onChange={event => setCategory(event.target.value as CategoryFilter)}
          >
            <option value="all">Todas as categorias</option>
            {eventTypes.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      {loading ? (
        <section className="card">
          <div className="card-body">
            <p className="muted" role="status">
              Carregando calendário…
            </p>
          </div>
        </section>
      ) : view === "day" || view === "week" ? (
        <section
          className="card gcal-card"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <TimeGrid
            days={gridDays}
            timedByDay={timedByDay}
            allDayByDay={allDayByDay}
            onSlot={date => openNewEvent(date)}
            onSelect={openExistingEvent}
          />
        </section>
      ) : view === "month" ? (
        <section className="card">
          <div className="card-body">
            <MonthGrid
              month={visibleMonth}
              eventsByDay={eventsByDay}
              onAdd={openNewEvent}
              onSelect={openExistingEvent}
            />
            {!monthEvents.length && (
              <p className="muted helper">
                Nenhum evento corresponde aos filtros neste mês.
              </p>
            )}
          </div>
        </section>
      ) : (
        <section className="card">
          <div className="card-body">
            <EventList
              events={listEvents}
              onSelect={openExistingEvent}
              onCreate={() => openNewEvent()}
            />
          </div>
        </section>
      )}

      <button
        type="button"
        className="gcal-fab"
        aria-label="Criar evento"
        onClick={() => openNewEvent()}
      >
        <Plus size={22} /> <span>Criar</span>
      </button>

      {editor && (
        <FormModal
          title={editor.isNew ? "Novo evento" : "Editar evento"}
          onClose={() => setEditor(null)}
          onSubmit={saveEditor}
          submitLabel={editor.isNew ? "Salvar evento" : "Salvar alterações"}
        >
          <div className="form-grid">
            <Field label="Título" className="field-full">
              <input
                value={editor.draft.title}
                onChange={event => updateDraft({ title: event.target.value })}
                placeholder="Ex.: Avaliação de farol"
                required
                autoFocus
              />
            </Field>
            <Field label="Categoria">
              <select
                value={editor.draft.type}
                onChange={event =>
                  updateDraft({ type: event.target.value as EventType })
                }
              >
                {eventTypes.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Data" help="Ano entre 1900 e 2100.">
              <DateInput
                value={editor.draft.date}
                min="1900-01-01"
                max="2100-12-31"
                onChange={event => updateDraft({ date: event.target.value })}
                required
              />
            </Field>
            <Field label="Dia inteiro">
              <label className="row">
                <input
                  type="checkbox"
                  checked={editor.draft.allDay}
                  onChange={event => updateDraft({ allDay: event.target.checked })}
                />
                Evento de dia inteiro
              </label>
            </Field>
            {!editor.draft.allDay && (
              <>
                <Field label="Hora de início">
                  <input
                    type="time"
                    value={editor.draft.time}
                    step="60"
                    onChange={event => updateDraft({ time: event.target.value })}
                    required
                  />
                </Field>
                <Field label="Duração">
                  <select
                    value={editor.draft.duration}
                    onChange={event =>
                      updateDraft({ duration: Number(event.target.value) })
                    }
                  >
                    {[15, 30, 45, 60, 90, 120, 180, 240, 480].map(minutes => (
                      <option key={minutes} value={minutes}>
                        {minutes < 60
                          ? `${minutes} min`
                          : `${minutes / 60}${minutes % 60 ? "" : ""} h`.replace(".", ",")}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}
            <Field label="Detalhes" className="field-full">
              <textarea
                value={editor.draft.detail}
                onChange={event => updateDraft({ detail: event.target.value })}
                placeholder="Escopo, responsável, preparação ou observações…"
                rows={4}
              />
            </Field>
          </div>
          {!editor.isNew && googleCalendarUrl(toCalendarEventSafe(editor.draft) ?? ({} as CalendarEvent)) && (
            <a
              className="btn btn-secondary"
              href={googleCalendarUrl(toCalendarEventSafe(editor.draft)!)!}
              target="_blank"
              rel="noopener noreferrer"
            >
              <CalendarPlus size={18} /> Adicionar ao Google Agenda
            </a>
          )}
          {!editor.isNew && (
            <div className="row">
              <ConfirmButton
                label="Remover evento"
                confirmation="Remover este evento do calendário? Esta ação não pode ser desfeita."
                onConfirm={deleteEditor}
              />
            </div>
          )}
        </FormModal>
      )}
    </main>
  );
}
