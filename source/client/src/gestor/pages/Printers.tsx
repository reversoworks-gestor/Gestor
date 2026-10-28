import { DateInput } from "../components/ui";
import { useMemo, useState, type FormEvent } from "react";
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Edit3,
  Plus,
  Printer as PrinterIcon,
  Search,
  Thermometer,
  Trash2,
  Wrench,
} from "lucide-react";
import type { MaintenanceEntry, Printer } from "../../lib/models";
import { useGestor } from "../store";
import {
  Badge,
  Button,
  ConfirmButton,
  EmptyState,
  Field,
  FormModal,
  Modal,
  PageHeading,
} from "../components/ui";
import { dateLabel, makeId, today } from "../types";

const MIN_DATE = "1900-01-01";
const MAX_DATE = "2100-12-31";
const THERMAL_LIMIT = 1000;
const NOZZLE_DIAMETER_LIMIT = 10;

type MaintenanceDraft = MaintenanceEntry;

function createPrinter(): Printer {
  return {
    id: makeId("printer"),
    name: "",
    model: "",
    status: "Pronta",
    material: "",
    lastMaintenance: "",
    maintenance: [],
    maxNozzleTemp: undefined,
    maxBedTemp: undefined,
    maxChamberTemp: undefined,
    buildVolume: "",
    nozzleDiameter: undefined,
    hardenedNozzle: false,
    dryingAvailable: false,
    compatibleMaterials: [],
  };
}

function createMaintenance(): MaintenanceDraft {
  return {
    id: makeId("maintenance"),
    date: today(),
    title: "",
    notes: "",
    status: "Concluída",
  };
}

function isRealDate(value: string): boolean {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value < MIN_DATE ||
    value > MAX_DATE
  )
    return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function dateInputValue(value: string): string {
  const candidate = value.slice(0, 10);
  return isRealDate(candidate) ? candidate : "";
}

function optionalNumber(value: string): number | undefined {
  return value === "" ? undefined : Number(value);
}

function validOptionalNumber(
  value: number | undefined,
  label: string,
  maximum: number
): void {
  if (value === undefined) return;
  if (!Number.isFinite(value) || value < 0 || value > maximum) {
    throw new Error(`${label} deve ser um número entre 0 e ${maximum}.`);
  }
}

function normalizePrinter(printer: Printer): Printer {
  const name = printer.name.trim();
  const model = printer.model.trim();

  if (!name) throw new Error("Informe o nome da impressora.");
  if (!model) throw new Error("Informe o modelo da impressora.");

  validOptionalNumber(
    printer.maxNozzleTemp,
    "A temperatura máxima do bico",
    THERMAL_LIMIT
  );
  validOptionalNumber(
    printer.maxBedTemp,
    "A temperatura máxima da mesa",
    THERMAL_LIMIT
  );
  validOptionalNumber(
    printer.maxChamberTemp,
    "A temperatura máxima da câmara",
    THERMAL_LIMIT
  );
  validOptionalNumber(
    printer.nozzleDiameter,
    "O diâmetro do bico",
    NOZZLE_DIAMETER_LIMIT
  );

  return {
    ...printer,
    name,
    model,
    material: printer.material.trim(),
    buildVolume: (printer.buildVolume ?? "").trim(),
    compatibleMaterials: Array.from(
      new Set(
        (printer.compatibleMaterials ?? [])
          .map(item => item.trim())
          .filter(Boolean)
      )
    ),
    maintenance: printer.maintenance ?? [],
  };
}

function normalizeMaintenance(entry: MaintenanceDraft): MaintenanceEntry {
  const title = entry.title.trim();
  if (!title) throw new Error("Informe a atividade de manutenção.");
  if (!isRealDate(entry.date)) {
    throw new Error(
      `Informe uma data real entre ${MIN_DATE.slice(0, 4)} e ${MAX_DATE.slice(0, 4)}.`
    );
  }

  return {
    ...entry,
    title,
    notes: entry.notes.trim(),
  };
}

function sortMaintenance(entries: MaintenanceEntry[]): MaintenanceEntry[] {
  return [...entries].sort(
    (left, right) =>
      right.date.localeCompare(left.date) || right.id.localeCompare(left.id)
  );
}

function lastCompletedMaintenance(entries: MaintenanceEntry[]): string {
  return (
    sortMaintenance(
      entries.filter(
        entry => entry.status === "Concluída" && isRealDate(entry.date)
      )
    )[0]?.date ?? ""
  );
}

function hasCompletedMaintenance(entries: MaintenanceEntry[]): boolean {
  return entries.some(
    entry => entry.status === "Concluída" && isRealDate(entry.date)
  );
}

function printerStatusTone(
  status: Printer["status"]
): "success" | "warning" | "neutral" {
  if (status === "Pronta") return "success";
  if (status === "Em manutenção") return "warning";
  return "neutral";
}

function maintenanceStatusTone(
  status: MaintenanceEntry["status"]
): "success" | "gold" {
  return status === "Concluída" ? "success" : "gold";
}

function temperatureLabel(value: number | undefined): string {
  return value === undefined ? "Não informado" : `${value} °C`;
}

function maintenanceDateLabel(value: string): string {
  return isRealDate(dateInputValue(value))
    ? dateLabel(dateInputValue(value))
    : "Data não informada";
}

export default function PrintersPage() {
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
  const [editor, setEditor] = useState<Printer | null>(null);
  const [maintenancePrinterId, setMaintenancePrinterId] = useState<
    string | null
  >(null);

  const normalizedSearch = search.trim().toLocaleLowerCase();
  const printers = useMemo(() => {
    if (!normalizedSearch) return data.printers;
    return data.printers.filter(printer => {
      const searchable = [
        printer.name,
        printer.model,
        printer.status,
        printer.material,
        printer.buildVolume ?? "",
        ...(printer.compatibleMaterials ?? []),
        ...(printer.maintenance ?? []).flatMap(entry => [
          entry.title,
          entry.notes,
          entry.status,
          entry.date,
        ]),
      ]
        .join(" ")
        .toLocaleLowerCase();
      return searchable.includes(normalizedSearch);
    });
  }, [data.printers, normalizedSearch]);

  const maintenancePrinter = maintenancePrinterId
    ? (data.printers.find(printer => printer.id === maintenancePrinterId) ??
      null)
    : null;

  async function savePrinter(printer: Printer): Promise<void> {
    await save("printers", normalizePrinter(printer));
    notify(
      printer.name.trim() ? "Perfil da impressora salvo." : "Impressora salva.",
      "success"
    );
  }

  async function deletePrinter(printer: Printer): Promise<void> {
    try {
      await remove("printers", printer.id);
      notify("Impressora removida.", "success");
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "Não foi possível remover a impressora.";
      notify(message, "error");
      throw cause;
    }
  }

  return (
    <section className="stack" aria-labelledby="printers-page-title">
      <PageHeading
        eyebrow="Produção"
        title="Impressoras e manutenção"
        description="Perfis técnicos, capacidades de processo e histórico operacional de cada máquina."
        action={
          <Button variant="primary" onClick={() => setEditor(createPrinter())}>
            <Plus size={17} /> Nova impressora
          </Button>
        }
      />

      {loading && (
        <div className="card" role="status" aria-live="polite">
          <div className="card-body row">
            <span className="spinner" aria-hidden="true" /> Carregando
            impressoras…
          </div>
        </div>
      )}

      {!loading && error && (
        <div className="card error-message" role="alert">
          <div className="card-body split">
            <div className="row">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
            <Button onClick={retry}>Tentar novamente</Button>
          </div>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="toolbar">
            <Field label="Buscar impressoras" className="field-full">
              <span className="row">
                <Search size={18} aria-hidden="true" />
                <input
                  aria-label="Buscar por nome, modelo, material ou manutenção"
                  type="search"
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Nome, modelo, material ou atividade de manutenção"
                />
              </span>
            </Field>
            <p className="muted" aria-live="polite">
              {printers.length}{" "}
              {printers.length === 1
                ? "impressora encontrada"
                : "impressoras encontradas"}
            </p>
          </div>

          {!data.printers.length ? (
            <EmptyState
              title="Nenhuma impressora cadastrada"
              description="Cadastre a capacidade da máquina antes de registrar produção ou manutenção."
              action={
                <Button
                  variant="primary"
                  onClick={() => setEditor(createPrinter())}
                >
                  <Plus size={17} /> Cadastrar impressora
                </Button>
              }
            />
          ) : !printers.length ? (
            <EmptyState
              title="Nenhuma impressora corresponde à busca"
              description="Tente outro nome, modelo, material ou limpe a busca."
              action={
                <Button onClick={() => setSearch("")}>Limpar busca</Button>
              }
            />
          ) : (
            <div className="grid grid-2" aria-label="Perfis de impressoras">
              {printers.map(printer => (
                <PrinterCard
                  key={printer.id}
                  printer={printer}
                  onEdit={() =>
                    setEditor({
                      ...printer,
                      maintenance: [...(printer.maintenance ?? [])],
                    })
                  }
                  onMaintenance={() => setMaintenancePrinterId(printer.id)}
                  onDelete={() => deletePrinter(printer)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {editor && (
        <PrinterForm
          printer={editor}
          onClose={() => setEditor(null)}
          onSave={savePrinter}
        />
      )}

      {maintenancePrinter && (
        <MaintenanceModal
          printer={maintenancePrinter}
          onClose={() => setMaintenancePrinterId(null)}
        />
      )}
    </section>
  );
}

function PrinterCard({
  printer,
  onEdit,
  onMaintenance,
  onDelete,
}: {
  printer: Printer;
  onEdit: () => void;
  onMaintenance: () => void;
  onDelete: () => Promise<void>;
}) {
  const completedDate = lastCompletedMaintenance(printer.maintenance ?? []);
  const displayedLastMaintenance = completedDate || printer.lastMaintenance;
  const scheduled = sortMaintenance(
    (printer.maintenance ?? []).filter(entry => entry.status === "Agendada")
  )[0];

  return (
    <article className="card" aria-label={`${printer.name}, ${printer.model}`}>
      <header className="card-head split">
        <div className="row">
          <PrinterIcon size={22} aria-hidden="true" />
          <div>
            <h2>{printer.name}</h2>
            <p className="muted">{printer.model}</p>
          </div>
        </div>
        <Badge tone={printerStatusTone(printer.status)}>{printer.status}</Badge>
      </header>

      <div className="card-body stack">
        <div className="details-grid">
          <div className="key-value">
            <span>Material atual</span>
            <strong>{printer.material || "Não definido"}</strong>
          </div>
          <div className="key-value">
            <span>Volume útil</span>
            <strong>{printer.buildVolume || "Não informado"}</strong>
          </div>
          <div className="key-value">
            <span>
              <Thermometer size={14} aria-hidden="true" /> Bico máximo
            </span>
            <strong>{temperatureLabel(printer.maxNozzleTemp)}</strong>
          </div>
          <div className="key-value">
            <span>
              <Thermometer size={14} aria-hidden="true" /> Mesa máxima
            </span>
            <strong>{temperatureLabel(printer.maxBedTemp)}</strong>
          </div>
          <div className="key-value">
            <span>
              <Thermometer size={14} aria-hidden="true" /> Câmara máxima
            </span>
            <strong>{temperatureLabel(printer.maxChamberTemp)}</strong>
          </div>
          <div className="key-value">
            <span>Diâmetro do bico</span>
            <strong>
              {printer.nozzleDiameter === undefined
                ? "Não informado"
                : `${printer.nozzleDiameter} mm`}
            </strong>
          </div>
          <div className="key-value">
            <span>Bico endurecido</span>
            <strong>
              {printer.hardenedNozzle ? "Disponível" : "Não disponível"}
            </strong>
          </div>
          <div className="key-value">
            <span>Secagem</span>
            <strong>
              {printer.dryingAvailable ? "Disponível" : "Não disponível"}
            </strong>
          </div>
        </div>

        <div className="divider" />

        <div className="stack">
          <div className="split">
            <span className="row">
              <Wrench size={16} aria-hidden="true" />{" "}
              <strong>Manutenção</strong>
            </span>
            <Button variant="ghost" onClick={onMaintenance}>
              Gerenciar
            </Button>
          </div>
          <div className="key-value">
            <span>Última concluída</span>
            <strong>
              {displayedLastMaintenance
                ? maintenanceDateLabel(displayedLastMaintenance)
                : "Não registrada"}
            </strong>
          </div>
          {scheduled ? (
            <p className="muted row">
              <CalendarClock size={15} aria-hidden="true" /> Agendada:{" "}
              {scheduled.title} · {maintenanceDateLabel(scheduled.date)}
            </p>
          ) : (
            <p className="muted">Nenhuma manutenção agendada.</p>
          )}
        </div>

        <div>
          <p className="muted">Materiais compatíveis</p>
          {printer.compatibleMaterials?.length ? (
            <div className="wrap">
              {printer.compatibleMaterials.map(material => (
                <span className="chip" key={material}>
                  {material}
                </span>
              ))}
            </div>
          ) : (
            <p>Não informados.</p>
          )}
        </div>
      </div>

      <footer className="card-footer row wrap">
        <Button onClick={onEdit}>
          <Edit3 size={16} /> Editar perfil
        </Button>
        <Button onClick={onMaintenance}>
          <Wrench size={16} /> Manutenção
        </Button>
        <ConfirmButton
          label="Excluir"
          confirmation={`Excluir o perfil de ${printer.name}? O histórico de manutenção desta impressora também será removido.`}
          onConfirm={onDelete}
        />
      </footer>
    </article>
  );
}

function PrinterForm({
  printer,
  onClose,
  onSave,
}: {
  printer: Printer;
  onClose: () => void;
  onSave: (printer: Printer) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Printer>(printer);
  const isNew =
    !printer.name.trim() &&
    !printer.model.trim() &&
    !(printer.maintenance ?? []).length;

  function patch(patchValue: Partial<Printer>): void {
    setDraft(current => ({ ...current, ...patchValue }));
  }

  return (
    <FormModal
      title={isNew ? "Nova impressora" : `Editar · ${printer.name}`}
      onClose={onClose}
      onSubmit={() => onSave(draft)}
      submitLabel="Salvar perfil"
    >
      <div className="form-grid">
        <Field label="Nome da impressora">
          <input
            required
            maxLength={100}
            value={draft.name}
            onChange={event => patch({ name: event.target.value })}
            placeholder="Ex.: Bambu Lab X1 Carbon"
          />
        </Field>
        <Field label="Modelo / configuração">
          <input
            required
            maxLength={120}
            value={draft.model}
            onChange={event => patch({ model: event.target.value })}
            placeholder="Ex.: X1 Carbon com AMS"
          />
        </Field>
        <Field label="Status operacional">
          <select
            value={draft.status}
            onChange={event =>
              patch({ status: event.target.value as Printer["status"] })
            }
          >
            <option value="Pronta">Pronta</option>
            <option value="Em manutenção">Em manutenção</option>
            <option value="Pausada">Pausada</option>
          </select>
        </Field>
        <Field
          label="Material carregado"
          help="Material atualmente instalado ou preparado na máquina."
        >
          <input
            maxLength={100}
            value={draft.material}
            onChange={event => patch({ material: event.target.value })}
            placeholder="Ex.: ASA preto"
          />
        </Field>

        <Field label="Bico máximo (°C)">
          <input
            type="number"
            min="0"
            max={THERMAL_LIMIT}
            step="1"
            inputMode="numeric"
            value={draft.maxNozzleTemp ?? ""}
            onChange={event =>
              patch({ maxNozzleTemp: optionalNumber(event.target.value) })
            }
          />
        </Field>
        <Field label="Mesa máxima (°C)">
          <input
            type="number"
            min="0"
            max={THERMAL_LIMIT}
            step="1"
            inputMode="numeric"
            value={draft.maxBedTemp ?? ""}
            onChange={event =>
              patch({ maxBedTemp: optionalNumber(event.target.value) })
            }
          />
        </Field>
        <Field label="Câmara máxima (°C)">
          <input
            type="number"
            min="0"
            max={THERMAL_LIMIT}
            step="1"
            inputMode="numeric"
            value={draft.maxChamberTemp ?? ""}
            onChange={event =>
              patch({ maxChamberTemp: optionalNumber(event.target.value) })
            }
          />
        </Field>
        <Field label="Diâmetro do bico (mm)">
          <input
            type="number"
            min="0"
            max={NOZZLE_DIAMETER_LIMIT}
            step="0.01"
            inputMode="decimal"
            value={draft.nozzleDiameter ?? ""}
            onChange={event =>
              patch({ nozzleDiameter: optionalNumber(event.target.value) })
            }
          />
        </Field>
        <Field label="Volume útil X × Y × Z (mm)" className="field-full">
          <input
            maxLength={80}
            value={draft.buildVolume ?? ""}
            onChange={event => patch({ buildVolume: event.target.value })}
            placeholder="Ex.: 256 × 256 × 256"
          />
        </Field>
        <Field
          label="Materiais compatíveis"
          help="Separe os materiais por vírgula."
          className="field-full"
        >
          <input
            maxLength={500}
            value={(draft.compatibleMaterials ?? []).join(", ")}
            onChange={event =>
              patch({
                compatibleMaterials: event.target.value
                  .split(",")
                  .map(item => item.trim())
                  .filter(Boolean),
              })
            }
            placeholder="PLA, PETG, ASA, PA6-CF"
          />
        </Field>
        <div className="field field-full">
          <span className="field-label">Recursos do processo</span>
          <div className="row wrap">
            <label className="row">
              <input
                type="checkbox"
                checked={Boolean(draft.hardenedNozzle)}
                onChange={event =>
                  patch({ hardenedNozzle: event.target.checked })
                }
              />{" "}
              Bico endurecido disponível
            </label>
            <label className="row">
              <input
                type="checkbox"
                checked={Boolean(draft.dryingAvailable)}
                onChange={event =>
                  patch({ dryingAvailable: event.target.checked })
                }
              />{" "}
              Secagem controlada disponível
            </label>
          </div>
        </div>
      </div>
    </FormModal>
  );
}

function MaintenanceModal({
  printer,
  onClose,
}: {
  printer: Printer;
  onClose: () => void;
}) {
  const { save, notify } = useGestor();
  const [draft, setDraft] = useState<MaintenanceDraft | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<MaintenanceEntry | null>(
    null
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const entries = sortMaintenance(printer.maintenance ?? []);

  async function persistEntries(
    nextEntries: MaintenanceEntry[],
    successMessage: string
  ): Promise<void> {
    setBusy(true);
    setError("");
    try {
      const maintenance = sortMaintenance(nextEntries);
      const completedDate = lastCompletedMaintenance(maintenance);
      await save("printers", {
        ...printer,
        maintenance,
        lastMaintenance:
          completedDate || hasCompletedMaintenance(entries)
            ? completedDate
            : printer.lastMaintenance,
      });
      setDraft(null);
      setConfirmDelete(null);
      notify(successMessage, "success");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível salvar a manutenção."
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveEntry(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!draft || busy) return;
    try {
      const entry = normalizeMaintenance(draft);
      const exists = entries.some(item => item.id === entry.id);
      await persistEntries(
        exists
          ? entries.map(item => (item.id === entry.id ? entry : item))
          : [...entries, entry],
        exists ? "Manutenção atualizada." : "Manutenção registrada."
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível validar a manutenção."
      );
    }
  }

  return (
    <Modal
      title={`Manutenção · ${printer.name}`}
      onClose={() => {
        if (!busy) onClose();
      }}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            Fechar
          </Button>
          {!draft && (
            <Button
              variant="primary"
              disabled={busy}
              onClick={() => {
                setError("");
                setConfirmDelete(null);
                setDraft(createMaintenance());
              }}
            >
              <Plus size={16} /> Adicionar manutenção
            </Button>
          )}
        </>
      }
    >
      <div className="stack">
        <div className="card">
          <div className="card-body details-grid">
            <div className="key-value">
              <span>Última concluída</span>
              <strong>
                {printer.lastMaintenance
                  ? maintenanceDateLabel(printer.lastMaintenance)
                  : "Não registrada"}
              </strong>
            </div>
            <div className="key-value">
              <span>Entradas registradas</span>
              <strong>{entries.length}</strong>
            </div>
          </div>
        </div>

        {error && (
          <div className="error-message" role="alert">
            <AlertCircle size={18} /> {error}
          </div>
        )}

        {draft ? (
          <form
            className="stack"
            onSubmit={event => void saveEntry(event)}
            aria-busy={busy}
          >
            <div className="split">
              <div>
                <p className="eyebrow">
                  {entries.some(item => item.id === draft.id)
                    ? "Editar registro"
                    : "Novo registro"}
                </p>
                <h3>
                  {entries.some(item => item.id === draft.id)
                    ? "Atualizar manutenção"
                    : "Registrar manutenção"}
                </h3>
              </div>
              <Button
                type="button"
                disabled={busy}
                onClick={() => {
                  setDraft(null);
                  setError("");
                }}
              >
                Cancelar edição
              </Button>
            </div>
            <div className="form-grid">
              <Field label="Atividade" className="field-full">
                <input
                  required
                  maxLength={160}
                  value={draft.title}
                  onChange={event =>
                    setDraft(current =>
                      current
                        ? { ...current, title: event.target.value }
                        : current
                    )
                  }
                  placeholder="Ex.: Limpeza de bico e lubrificação"
                />
              </Field>
              <Field
                label="Data da manutenção"
                help="Use uma data real entre 1900 e 2100."
              >
                <DateInput
                  required
                  min={MIN_DATE}
                  max={MAX_DATE}
                  value={dateInputValue(draft.date)}
                  onChange={event =>
                    setDraft(current =>
                      current
                        ? { ...current, date: event.target.value }
                        : current
                    )
                  }
                />
              </Field>
              <Field label="Situação">
                <select
                  value={draft.status}
                  onChange={event =>
                    setDraft(current =>
                      current
                        ? {
                            ...current,
                            status: event.target
                              .value as MaintenanceEntry["status"],
                          }
                        : current
                    )
                  }
                >
                  <option value="Concluída">Concluída</option>
                  <option value="Agendada">Agendada</option>
                </select>
              </Field>
              <Field label="Notas" className="field-full">
                <textarea
                  maxLength={2000}
                  value={draft.notes}
                  onChange={event =>
                    setDraft(current =>
                      current
                        ? { ...current, notes: event.target.value }
                        : current
                    )
                  }
                  placeholder="Peças substituídas, limpeza executada, pendências ou próxima revisão…"
                />
              </Field>
            </div>
            <div className="row wrap">
              <Button
                type="button"
                disabled={busy}
                onClick={() => {
                  setDraft(null);
                  setError("");
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" variant="primary" disabled={busy}>
                {busy ? "Salvando…" : "Salvar manutenção"}
              </Button>
            </div>
          </form>
        ) : confirmDelete ? (
          <div
            className="card stack"
            role="alertdialog"
            aria-labelledby={`delete-maintenance-${confirmDelete.id}`}
          >
            <div className="card-body stack">
              <div className="row">
                <AlertCircle size={20} aria-hidden="true" />
                <h3 id={`delete-maintenance-${confirmDelete.id}`}>
                  Excluir manutenção?
                </h3>
              </div>
              <p>
                O registro “{confirmDelete.title}” será removido do histórico
                desta impressora.
              </p>
              <div className="row wrap">
                <Button disabled={busy} onClick={() => setConfirmDelete(null)}>
                  Cancelar
                </Button>
                <Button
                  variant="danger"
                  disabled={busy}
                  onClick={() =>
                    void persistEntries(
                      entries.filter(item => item.id !== confirmDelete.id),
                      "Manutenção removida."
                    )
                  }
                >
                  {busy ? "Excluindo…" : "Excluir manutenção"}
                </Button>
              </div>
            </div>
          </div>
        ) : entries.length ? (
          <div className="list" aria-label="Histórico de manutenção">
            {entries.map(entry => (
              <article className="list-row" key={entry.id}>
                <div className="stack">
                  <div className="split">
                    <strong className="row">
                      {entry.status === "Concluída" ? (
                        <CheckCircle2 size={17} aria-hidden="true" />
                      ) : (
                        <CalendarClock size={17} aria-hidden="true" />
                      )}
                      {entry.title}
                    </strong>
                    <Badge tone={maintenanceStatusTone(entry.status)}>
                      {entry.status}
                    </Badge>
                  </div>
                  <p className="muted">{maintenanceDateLabel(entry.date)}</p>
                  {entry.notes && <p>{entry.notes}</p>}
                </div>
                <div className="row wrap">
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      setError("");
                      setConfirmDelete(null);
                      setDraft({ ...entry, date: dateInputValue(entry.date) });
                    }}
                  >
                    <Edit3 size={16} /> Editar
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      setError("");
                      setDraft(null);
                      setConfirmDelete(entry);
                    }}
                  >
                    <Trash2 size={16} /> Excluir
                  </Button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Nenhuma manutenção registrada"
            description="Registre intervenções concluídas ou programe a próxima manutenção da máquina."
            action={
              <Button
                variant="primary"
                onClick={() => setDraft(createMaintenance())}
              >
                <Plus size={16} /> Adicionar manutenção
              </Button>
            }
          />
        )}
      </div>
    </Modal>
  );
}
