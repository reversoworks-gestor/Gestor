import { DateInput } from "../components/ui";
import { useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  List,
  Plus,
  Search,
} from "lucide-react";
import type { CalendarEvent } from "../../lib/models";
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

type CalendarView = "month" | "list";
type EventType = CalendarEvent["type"];
type CategoryFilter = EventType | "all";
type LocalDateTime = { date: string; time: string };
type EventDraft = LocalDateTime &
  Pick<CalendarEvent, "id" | "title" | "detail" | "type">;
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
  return { ...event, ...eventLocalDateTime(event.date) };
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
  };
}

function toCalendarEvent(draft: EventDraft): CalendarEvent {
  const title = draft.title.trim();
  if (!title) throw new Error("Informe um título para o evento.");
  return {
    id: draft.id,
    title,
    detail: draft.detail.trim(),
    type: draft.type,
    date: localDateTimeToIso(draft),
  };
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
  const [view, setView] = useState<CalendarView>("month");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(new Date())
  );
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

  const monthTitle = monthFormatter.format(visibleMonth);
  const currentMonthEvents = monthEvents.length;

  return (
    <main className="stack">
      <PageHeading
        eyebrow="Planejamento operacional"
        title="Calendário"
        description="Compromissos cadastrados para a operação. Registros de serviço não são incluídos automaticamente como eventos."
        action={
          <Button variant="primary" onClick={() => openNewEvent()}>
            <Plus size={18} /> Novo evento
          </Button>
        }
      />

      {error && (
        <div className="error-message" role="alert">
          <span>Não foi possível carregar os dados do calendário: {error}</span>
          <Button variant="secondary" onClick={retry}>
            Tentar novamente
          </Button>
        </div>
      )}

      <section className="card" aria-label="Controles do calendário">
        <div className="card-body stack">
          <div className="toolbar wrap">
            <Field label="Buscar eventos" className="calendar-search-field">
              <span className="calendar-search-input">
                <Search size={18} aria-hidden="true" />
                <input
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Título, detalhe ou categoria"
                />
              </span>
            </Field>
            <Field label="Categoria">
              <select
                value={category}
                onChange={event =>
                  setCategory(event.target.value as CategoryFilter)
                }
              >
                <option value="all">Todas as categorias</option>
                {eventTypes.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </Field>
            <div
              className="tabs"
              role="tablist"
              aria-label="Visualização do calendário"
            >
              <Button
                variant={view === "month" ? "primary" : "secondary"}
                role="tab"
                aria-selected={view === "month"}
                onClick={() => setView("month")}
              >
                <CalendarDays size={18} /> Mês
              </Button>
              <Button
                variant={view === "list" ? "primary" : "secondary"}
                role="tab"
                aria-selected={view === "list"}
                onClick={() => setView("list")}
              >
                <List size={18} /> Lista
              </Button>
            </div>
          </div>

          <div className="split calendar-period-header">
            <div>
              <p className="eyebrow">Período selecionado</p>
              <h2>{monthTitle}</h2>
              <p className="muted">
                {currentMonthEvents === 1
                  ? "1 evento encontrado"
                  : `${currentMonthEvents} eventos encontrados`}
              </p>
            </div>
            <div className="row wrap">
              <Button
                variant="secondary"
                aria-label="Mês anterior"
                onClick={() =>
                  setVisibleMonth(
                    current =>
                      new Date(current.getFullYear(), current.getMonth() - 1, 1)
                  )
                }
              >
                <ChevronLeft size={18} /> Anterior
              </Button>
              <Button
                variant="secondary"
                onClick={() => setVisibleMonth(startOfMonth(new Date()))}
              >
                Hoje
              </Button>
              <Button
                variant="secondary"
                aria-label="Próximo mês"
                onClick={() =>
                  setVisibleMonth(
                    current =>
                      new Date(current.getFullYear(), current.getMonth() + 1, 1)
                  )
                }
              >
                Próximo <ChevronRight size={18} />
              </Button>
            </div>
          </div>
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
                Nenhum evento corresponde aos filtros neste mês. Selecione um
                dia acima para adicionar um compromisso.
              </p>
            )}
          </div>
        </section>
      ) : (
        <section className="card">
          <div className="card-body">
            <EventList
              events={monthEvents}
              onSelect={openExistingEvent}
              onCreate={() => openNewEvent()}
            />
          </div>
        </section>
      )}

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
            <Field label="Data local" help="Ano entre 1900 e 2100.">
              <DateInput
                value={editor.draft.date}
                min="1900-01-01"
                max="2100-12-31"
                onChange={event => updateDraft({ date: event.target.value })}
                required
              />
            </Field>
            <Field label="Hora local">
              <input
                type="time"
                value={editor.draft.time}
                step="60"
                onChange={event => updateDraft({ time: event.target.value })}
                required
              />
            </Field>
            <Field label="Detalhes" className="field-full">
              <textarea
                value={editor.draft.detail}
                onChange={event => updateDraft({ detail: event.target.value })}
                placeholder="Escopo, responsável, preparação ou observações…"
                rows={4}
              />
            </Field>
          </div>
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
