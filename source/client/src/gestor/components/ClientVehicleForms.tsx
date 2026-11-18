import { Building2 } from "lucide-react";
import type { Client } from "../../lib/models";
import { makeId, type Vehicle } from "../types";
import { ConfirmButton, Field, FormModal } from "./ui";

export type ClientDraft = Client;
export type VehicleDraft = Vehicle;

export function splitName(client: Client) {
  if (client.firstName || client.lastName) {
    return {
      firstName: client.firstName ?? "",
      lastName: client.lastName ?? "",
    };
  }

  const [firstName = "", ...lastName] = client.name.trim().split(/\s+/);
  return { firstName, lastName: lastName.join(" ") };
}

export function clientName(client?: Client) {
  if (!client) return "Cliente não encontrado";
  const composed = `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim();
  return client.name.trim() || composed || "Cliente sem nome";
}

export function newClient(): ClientDraft {
  return {
    id: makeId("client"),
    name: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    company: "",
    address: "",
    notes: "",
  };
}

export function editableClient(client: Client): ClientDraft {
  const name = splitName(client);
  return { ...client, ...name };
}

export function newVehicle(clientId = ""): VehicleDraft {
  return {
    id: makeId("vehicle"),
    clientId,
    make: "",
    model: "",
    year: 0,
    plate: "",
    vin: "",
    color: "",
    notes: "",
  };
}

export function normalizeClient(draft: ClientDraft): Client {
  const firstName = draft.firstName?.trim() ?? "";
  const lastName = draft.lastName?.trim() ?? "";
  const name = `${firstName} ${lastName}`.trim();

  if (!firstName || !name) {
    throw new Error("Informe ao menos o primeiro nome do cliente.");
  }

  return {
    ...draft,
    name,
    firstName,
    lastName: lastName || undefined,
    email: draft.email.trim(),
    phone: draft.phone.trim(),
    company: draft.company.trim(),
    address: draft.address.trim(),
    notes: draft.notes.trim(),
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeVehicle(
  draft: VehicleDraft,
  clientIds: Set<string>
): Vehicle {
  const make = draft.make.trim();
  const model = draft.model.trim();
  const year = Number(draft.year);
  const currentYear = new Date().getFullYear() + 1;
  const plate = draft.plate.trim().toLocaleUpperCase("pt-BR");
  const vin = draft.vin.trim().toLocaleUpperCase("pt-BR");

  if (!clientIds.has(draft.clientId)) {
    throw new Error(
      "Selecione um cliente existente antes de salvar o veículo."
    );
  }
  if (!make || !model) {
    throw new Error("Informe marca e modelo do veículo.");
  }
  if (!Number.isInteger(year) || year < 1886 || year > currentYear) {
    throw new Error(`Informe um ano entre 1886 e ${currentYear}.`);
  }
  if (vin && !/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) {
    throw new Error(
      "O VIN deve conter 17 caracteres alfanuméricos válidos quando informado."
    );
  }

  return {
    ...draft,
    make,
    model,
    year,
    plate,
    vin,
    color: draft.color.trim(),
    notes: draft.notes.trim(),
    updatedAt: new Date().toISOString(),
  };
}

export function ClientForm({
  draft,
  linkedVehicleCount,
  onChange,
  onClose,
  onSave,
  onRemove,
  large,
}: {
  large?: boolean;
  draft: ClientDraft;
  linkedVehicleCount: number;
  onChange: (draft: ClientDraft) => void;
  onClose: () => void;
  onSave: () => Promise<void>;
  onRemove?: () => Promise<void>;
}) {
  const isExisting = Boolean(onRemove);
  const updateName = (firstName: string, lastName: string) =>
    onChange({
      ...draft,
      firstName,
      lastName,
      name: `${firstName} ${lastName}`.trim(),
    });

  return (
    <FormModal
      size={large ? "large" : undefined}
      title={isExisting ? "Editar cliente" : "Novo cliente"}
      onClose={onClose}
      onSubmit={onSave}
      submitLabel={isExisting ? "Salvar alterações" : "Cadastrar cliente"}
    >
      <div className="form-grid">
        <Field
          label="Primeiro nome *"
          help="Usado para compor o nome completo."
        >
          <input
            required
            autoComplete="given-name"
            value={draft.firstName ?? ""}
            onChange={event =>
              updateName(event.target.value, draft.lastName ?? "")
            }
            placeholder="Nome"
          />
        </Field>
        <Field label="Último nome" help="Opcional.">
          <input
            autoComplete="family-name"
            value={draft.lastName ?? ""}
            onChange={event =>
              updateName(draft.firstName ?? "", event.target.value)
            }
            placeholder="Sobrenome"
          />
        </Field>
        <div className="field field-full">
          <span className="field-label">Nome completo</span>
          <p className="helper" aria-live="polite">
            {`${draft.firstName ?? ""} ${draft.lastName ?? ""}`.trim() ||
              "Preencha o primeiro nome."}
          </p>
        </div>
        <Field label="Empresa" help="Opcional." className="field-full">
          <span className="row">
            <Building2 size={17} aria-hidden="true" />
            <input
              value={draft.company}
              onChange={event =>
                onChange({ ...draft, company: event.target.value })
              }
              placeholder="Empresa ou oficina"
              autoComplete="organization"
            />
          </span>
        </Field>
        <Field label="E-mail" help="Opcional.">
          <input
            type="email"
            autoComplete="email"
            value={draft.email}
            onChange={event =>
              onChange({ ...draft, email: event.target.value })
            }
            placeholder="contato@exemplo.com"
          />
        </Field>
        <Field label="Telefone" help="Opcional.">
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={draft.phone}
            onChange={event =>
              onChange({ ...draft, phone: event.target.value })
            }
            placeholder="(00) 00000-0000"
          />
        </Field>
        <Field label="Endereço" help="Opcional." className="field-full">
          <input
            autoComplete="street-address"
            value={draft.address}
            onChange={event =>
              onChange({ ...draft, address: event.target.value })
            }
            placeholder="Endereço de contato"
          />
        </Field>
        <Field
          label="Notas internas"
          help="Opcional. Não aparecem em documentos públicos."
          className="field-full"
        >
          <textarea
            value={draft.notes}
            onChange={event =>
              onChange({ ...draft, notes: event.target.value })
            }
            placeholder="Preferências, histórico e instruções de atendimento…"
          />
        </Field>
      </div>
      {onRemove && <div className="divider" />}
      {onRemove && (
        <div className="split">
          <p className="muted">
            {linkedVehicleCount
              ? `Este cliente possui ${linkedVehicleCount} veículo(s) vinculado(s).`
              : "A remoção é bloqueada pelo sistema se houver outros vínculos."}
          </p>
          <ConfirmButton
            label="Remover cliente"
            confirmation="Esta ação não pode ser desfeita. A remoção será recusada se o cliente ainda tiver veículos, pedidos ou avaliações vinculados."
            onConfirm={onRemove}
          />
        </div>
      )}
    </FormModal>
  );
}

export function VehicleForm({
  draft,
  clients,
  maxYear,
  onChange,
  onClose,
  onSave,
  onRemove,
  large,
}: {
  large?: boolean;
  draft: VehicleDraft;
  clients: Client[];
  maxYear: number;
  onChange: (draft: VehicleDraft) => void;
  onClose: () => void;
  onSave: () => Promise<void>;
  onRemove?: () => Promise<void>;
}) {
  const isExisting = Boolean(onRemove);
  const updateIdentifier = (key: "plate" | "vin", value: string) =>
    onChange({
      ...draft,
      [key]: value.toLocaleUpperCase("pt-BR"),
    });

  return (
    <FormModal
      size={large ? "large" : undefined}
      title={isExisting ? "Editar veículo" : "Novo veículo"}
      onClose={onClose}
      onSubmit={onSave}
      submitLabel={isExisting ? "Salvar alterações" : "Cadastrar veículo"}
    >
      <div className="form-grid">
        <Field
          label="Cliente responsável *"
          className="field-full"
          help="O vínculo é obrigatório e pode ser ajustado quando o veículo mudar de proprietário."
        >
          <select
            required
            value={draft.clientId}
            onChange={event =>
              onChange({ ...draft, clientId: event.target.value })
            }
          >
            <option value="" disabled>
              Selecione um cliente
            </option>
            {clients.map(client => (
              <option key={client.id} value={client.id}>
                {clientName(client)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Marca *">
          <input
            required
            autoComplete="off"
            value={draft.make}
            onChange={event => onChange({ ...draft, make: event.target.value })}
            placeholder="Ex.: fabricante"
          />
        </Field>
        <Field label="Modelo *">
          <input
            required
            autoComplete="off"
            value={draft.model}
            onChange={event =>
              onChange({ ...draft, model: event.target.value })
            }
            placeholder="Ex.: modelo / versão"
          />
        </Field>
        <Field label="Ano *">
          <input
            required
            type="number"
            inputMode="numeric"
            min="1886"
            max={maxYear}
            step="1"
            value={draft.year || ""}
            onChange={event =>
              onChange({ ...draft, year: Number(event.target.value) })
            }
            placeholder="AAAA"
          />
        </Field>
        <Field label="Cor" help="Opcional.">
          <input
            value={draft.color}
            onChange={event =>
              onChange({ ...draft, color: event.target.value })
            }
            placeholder="Cor predominante"
          />
        </Field>
        <Field label="Placa" help="Opcional.">
          <input
            value={draft.plate}
            maxLength={10}
            autoCapitalize="characters"
            onChange={event => updateIdentifier("plate", event.target.value)}
            placeholder="ABC1D23"
          />
        </Field>
        <Field
          label="VIN"
          help="Opcional; quando informado, deve ter 17 caracteres válidos."
          className="field-full"
        >
          <input
            value={draft.vin}
            minLength={draft.vin ? 17 : undefined}
            maxLength={17}
            pattern="[A-HJ-NPR-Za-hj-npr-z0-9]{17}"
            autoCapitalize="characters"
            onChange={event => updateIdentifier("vin", event.target.value)}
            placeholder="Número de identificação do veículo"
          />
        </Field>
        <Field
          label="Notas do veículo"
          help="Opcional. Registre apenas informações de atendimento; uma foto não substitui inspeção técnica."
          className="field-full"
        >
          <textarea
            value={draft.notes}
            onChange={event =>
              onChange({ ...draft, notes: event.target.value })
            }
            placeholder="Necessidade relatada, configuração e observações relevantes…"
          />
        </Field>
      </div>
      {onRemove && <div className="divider" />}
      {onRemove && (
        <div className="split">
          <p className="muted">
            A remoção é bloqueada se o veículo estiver vinculado a pedidos ou
            avaliações.
          </p>
          <ConfirmButton
            label="Remover veículo"
            confirmation="Esta ação não pode ser desfeita. O sistema recusará a remoção se o veículo ainda estiver vinculado a pedidos ou avaliações."
            onConfirm={onRemove}
          />
        </div>
      )}
    </FormModal>
  );
}
