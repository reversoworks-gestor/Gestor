import { useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  CarFront,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  UsersRound,
  X,
} from "lucide-react";
import type { Client } from "../../lib/models";
import { useGestor } from "../store";
import {
  makeId,
  type Assessment,
  type StudioOrder,
  type Vehicle,
} from "../types";
import {
  Badge,
  Button,
  ConfirmButton,
  EmptyState,
  Field,
  FormModal,
  PageHeading,
} from "../components/ui";

type ClientDraft = Client;
type VehicleDraft = Vehicle;

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();

const includesTerms = (source: string, query: string) => {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  const searchable = normalize(source);
  return terms.every(term => searchable.includes(term));
};

const sortByName = <T extends { name?: string; make?: string; model?: string }>(
  items: T[]
) =>
  [...items].sort((left, right) => {
    const leftLabel = left.name ?? `${left.make ?? ""} ${left.model ?? ""}`;
    const rightLabel = right.name ?? `${right.make ?? ""} ${right.model ?? ""}`;
    return leftLabel.localeCompare(rightLabel, "pt-BR", {
      sensitivity: "base",
    });
  });

function splitName(client: Client) {
  if (client.firstName || client.lastName) {
    return {
      firstName: client.firstName ?? "",
      lastName: client.lastName ?? "",
    };
  }

  const [firstName = "", ...lastName] = client.name.trim().split(/\s+/);
  return { firstName, lastName: lastName.join(" ") };
}

function clientName(client?: Client) {
  if (!client) return "Cliente não encontrado";
  const composed = `${client.firstName ?? ""} ${client.lastName ?? ""}`.trim();
  return client.name.trim() || composed || "Cliente sem nome";
}

function newClient(): ClientDraft {
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

function editableClient(client: Client): ClientDraft {
  const name = splitName(client);
  return { ...client, ...name };
}

function newVehicle(clientId = ""): VehicleDraft {
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

function normalizeClient(draft: ClientDraft): Client {
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

function normalizeVehicle(
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

export default function CustomersPage() {
  const ctx = useGestor();
  const [localQuery, setLocalQuery] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientDraft, setClientDraft] = useState<ClientDraft | null>(null);
  const [vehicleDraft, setVehicleDraft] = useState<VehicleDraft | null>(null);
  const [vehicleOwnerFilter, setVehicleOwnerFilter] = useState("");
  const isVehicleView = ctx.view === "vehicles";
  const clientIds = useMemo(
    () =>
      new Set<string>((ctx.data.clients as Client[]).map(client => client.id)),
    [ctx.data.clients]
  );
  const maxVehicleYear = new Date().getFullYear() + 1;

  const vehiclesByClient = useMemo(() => {
    const grouped = new Map<string, Vehicle[]>();
    for (const vehicle of ctx.data.vehicles as Vehicle[]) {
      const current = grouped.get(vehicle.clientId) ?? [];
      current.push(vehicle);
      grouped.set(vehicle.clientId, current);
    }
    return grouped;
  }, [ctx.data.vehicles]);

  const clients = useMemo(
    () =>
      sortByName<Client>(ctx.data.clients as Client[]).filter(client => {
        const vehicles = vehiclesByClient.get(client.id) ?? [];
        const searchable = [
          clientName(client),
          client.firstName,
          client.lastName,
          client.email,
          client.phone,
          client.company,
          client.address,
          client.notes,
          ...vehicles.flatMap(vehicle => [
            vehicle.make,
            vehicle.model,
            vehicle.plate,
            vehicle.vin,
            vehicle.color,
          ]),
        ]
          .filter(Boolean)
          .join(" ");

        return (
          includesTerms(searchable, localQuery) &&
          includesTerms(searchable, ctx.search)
        );
      }),
    [ctx.data.clients, ctx.search, localQuery, vehiclesByClient]
  );

  const vehicles = useMemo(
    () =>
      sortByName<Vehicle>(ctx.data.vehicles as Vehicle[]).filter(vehicle => {
        const owner = (ctx.data.clients as Client[]).find(
          client => client.id === vehicle.clientId
        );
        const searchable = [
          vehicle.make,
          vehicle.model,
          String(vehicle.year),
          vehicle.plate,
          vehicle.vin,
          vehicle.color,
          vehicle.notes,
          owner ? clientName(owner) : "",
          owner?.email,
          owner?.phone,
          owner?.company,
        ]
          .filter(Boolean)
          .join(" ");
        const ownerFilter = vehicleOwnerFilter || selectedClientId;

        return (
          (!ownerFilter || vehicle.clientId === ownerFilter) &&
          includesTerms(searchable, localQuery) &&
          includesTerms(searchable, ctx.search)
        );
      }),
    [
      ctx.data.clients,
      ctx.data.vehicles,
      ctx.search,
      localQuery,
      selectedClientId,
      vehicleOwnerFilter,
    ]
  );

  const selectedClient = (ctx.data.clients as Client[]).find(
    client => client.id === selectedClientId
  );
  const selectedVehicles = selectedClient
    ? (vehiclesByClient.get(selectedClient.id) ?? [])
    : [];

  const selectClient = (clientId: string) => {
    setSelectedClientId(clientId);
    setVehicleOwnerFilter(clientId);
  };

  const clearSelectedClient = () => {
    setSelectedClientId("");
    setVehicleOwnerFilter("");
  };

  const saveClient = async () => {
    if (!clientDraft) return;
    const saved = normalizeClient(clientDraft);
    await ctx.save("clients", saved);
    selectClient(saved.id);
  };

  const saveVehicle = async () => {
    if (!vehicleDraft) return;
    const saved = normalizeVehicle(vehicleDraft, clientIds);
    await ctx.save("vehicles", saved);
    selectClient(saved.clientId);
  };

  const removeClient = async (client: Client) => {
    const linkedVehicles = (ctx.data.vehicles as Vehicle[]).filter(
      vehicle => vehicle.clientId === client.id
    ).length;
    const linkedOrders = (ctx.data.orders as StudioOrder[]).filter(
      order => order.clientId === client.id
    ).length;
    const linkedAssessments = (ctx.data.triages as Assessment[]).filter(
      assessment => assessment.clientId === client.id
    ).length;
    const links = [
      linkedVehicles ? `${linkedVehicles} veículo(s)` : "",
      linkedOrders ? `${linkedOrders} pedido(s)` : "",
      linkedAssessments ? `${linkedAssessments} avaliação(ões)` : "",
    ].filter(Boolean);

    if (links.length) {
      throw new Error(
        `Não é possível remover este cliente enquanto houver ${links.join(", ")} vinculado(s).`
      );
    }

    await ctx.remove("clients", client.id);
    if (selectedClientId === client.id) clearSelectedClient();
    setClientDraft(null);
  };

  const removeVehicle = async (vehicle: Vehicle) => {
    const linkedOrders = (ctx.data.orders as StudioOrder[]).filter(
      order => order.vehicleId === vehicle.id
    ).length;
    const linkedAssessments = (ctx.data.triages as Assessment[]).filter(
      assessment => assessment.vehicleId === vehicle.id
    ).length;
    const links = [
      linkedOrders ? `${linkedOrders} pedido(s)` : "",
      linkedAssessments ? `${linkedAssessments} avaliação(ões)` : "",
    ].filter(Boolean);

    if (links.length) {
      throw new Error(
        `Não é possível remover este veículo enquanto houver ${links.join(", ")} vinculado(s).`
      );
    }

    await ctx.remove("vehicles", vehicle.id);
    setVehicleDraft(null);
  };

  const openVehicleCreate = () => {
    if (!ctx.data.clients.length) {
      ctx.notify("Cadastre um cliente antes de vincular um veículo.", "info");
      return;
    }
    setVehicleDraft(newVehicle(selectedClientId));
  };

  if (ctx.loading) {
    return (
      <main className="stack" aria-busy="true">
        <PageHeading
          eyebrow="Relacionamento"
          title="Clientes e veículos"
          description="Carregando os cadastros do estúdio…"
        />
        <p className="muted" role="status">
          Carregando clientes e veículos…
        </p>
      </main>
    );
  }

  if (ctx.error) {
    return (
      <main className="stack">
        <PageHeading
          eyebrow="Relacionamento"
          title="Clientes e veículos"
          description="Não foi possível carregar os cadastros."
        />
        <EmptyState
          title="Não foi possível abrir os cadastros"
          description={ctx.error}
          action={
            <Button variant="primary" onClick={ctx.retry}>
              Tentar novamente
            </Button>
          }
        />
      </main>
    );
  }

  return (
    <main className="stack">
      <PageHeading
        eyebrow="Relacionamento"
        title={isVehicleView ? "Veículos" : "Clientes"}
        description={
          isVehicleView
            ? "Veículos vinculados ao proprietário correto, prontos para avaliação e atendimento."
            : "Cadastre contatos e selecione o proprietário para consultar seus veículos."
        }
        action={
          <Button
            variant="primary"
            onClick={
              isVehicleView
                ? openVehicleCreate
                : () => setClientDraft(newClient())
            }
          >
            <Plus size={18} aria-hidden="true" />
            {isVehicleView ? "Novo veículo" : "Novo cliente"}
          </Button>
        }
      />

      <nav className="tabs" aria-label="Cadastros de relacionamento">
        <Button
          variant={isVehicleView ? "ghost" : "secondary"}
          className={isVehicleView ? "" : "active"}
          onClick={() => ctx.navigate("clients")}
          aria-current={!isVehicleView ? "page" : undefined}
        >
          <UsersRound size={17} aria-hidden="true" /> Clientes{" "}
          <Badge tone="neutral">{ctx.data.clients.length}</Badge>
        </Button>
        <Button
          variant={isVehicleView ? "secondary" : "ghost"}
          className={isVehicleView ? "active" : ""}
          onClick={() => ctx.navigate("vehicles")}
          aria-current={isVehicleView ? "page" : undefined}
        >
          <CarFront size={17} aria-hidden="true" /> Veículos{" "}
          <Badge tone="neutral">{ctx.data.vehicles.length}</Badge>
        </Button>
      </nav>

      <section className="toolbar" aria-label="Filtros de cadastro">
        <Field label="Busca nesta lista" className="field-full">
          <span className="row">
            <Search size={18} aria-hidden="true" />
            <input
              aria-label={
                isVehicleView
                  ? "Buscar veículos nesta lista"
                  : "Buscar clientes nesta lista"
              }
              value={localQuery}
              onChange={event => setLocalQuery(event.target.value)}
              placeholder={
                isVehicleView
                  ? "Marca, modelo, placa, VIN ou proprietário"
                  : "Nome, contato, empresa ou veículo"
              }
            />
          </span>
        </Field>
        <Field
          label="Busca global"
          className="field-full"
          help="Aplica-se também às outras áreas do Gestor."
        >
          <input
            aria-label="Busca global"
            value={ctx.search}
            onChange={event => ctx.setSearch(event.target.value)}
            placeholder="Pesquisar em todos os registros"
          />
        </Field>
        {isVehicleView && (
          <Field label="Cliente selecionado" className="field-full">
            <select
              aria-label="Filtrar veículos por cliente"
              value={vehicleOwnerFilter || selectedClientId}
              onChange={event => {
                const clientId = event.target.value;
                setVehicleOwnerFilter(clientId);
                setSelectedClientId(clientId);
              }}
            >
              <option value="">Todos os clientes</option>
              {sortByName<Client>(ctx.data.clients as Client[]).map(client => (
                <option key={client.id} value={client.id}>
                  {clientName(client)}
                </option>
              ))}
            </select>
          </Field>
        )}
      </section>

      {selectedClient && (
        <section
          className="card"
          aria-label={`Cliente selecionado: ${clientName(selectedClient)}`}
        >
          <div className="card-head split">
            <div>
              <p className="eyebrow">Cliente selecionado</p>
              <h2>{clientName(selectedClient)}</h2>
              <p className="muted">
                {selectedVehicles.length} veículo(s) associado(s)
              </p>
            </div>
            <div className="row wrap">
              <Button
                variant="secondary"
                onClick={() => setClientDraft(editableClient(selectedClient))}
              >
                <Pencil size={16} aria-hidden="true" /> Editar cliente
              </Button>
              <Button variant="ghost" onClick={clearSelectedClient}>
                <X size={16} aria-hidden="true" /> Limpar seleção
              </Button>
            </div>
          </div>
          {selectedVehicles.length > 0 && (
            <div className="card-body list">
              {sortByName<Vehicle>(selectedVehicles).map(vehicle => (
                <div className="list-row" key={vehicle.id}>
                  <span>
                    <CarFront size={17} aria-hidden="true" /> {vehicle.make}{" "}
                    {vehicle.model} · {vehicle.year}
                  </span>
                  <span className="muted">
                    {vehicle.plate || "Placa não informada"}
                  </span>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      ctx.navigate("vehicles");
                      setVehicleOwnerFilter(selectedClient.id);
                      setVehicleDraft({ ...vehicle });
                    }}
                  >
                    Editar <Pencil size={15} aria-hidden="true" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {isVehicleView ? (
        <VehicleList
          vehicles={vehicles}
          clients={ctx.data.clients as Client[]}
          hasActiveFilters={Boolean(
            localQuery || ctx.search || vehicleOwnerFilter || selectedClientId
          )}
          onCreate={openVehicleCreate}
          onEdit={vehicle => setVehicleDraft({ ...vehicle })}
          onSelectOwner={selectClient}
        />
      ) : (
        <ClientList
          clients={clients}
          vehiclesByClient={vehiclesByClient}
          selectedClientId={selectedClientId}
          hasActiveFilters={Boolean(localQuery || ctx.search)}
          onCreate={() => setClientDraft(newClient())}
          onEdit={client => setClientDraft(editableClient(client))}
          onSelect={selectClient}
          onViewVehicles={client => {
            selectClient(client.id);
            ctx.navigate("vehicles");
          }}
        />
      )}

      {clientDraft && (
        <ClientForm
          draft={clientDraft}
          linkedVehicleCount={
            (ctx.data.vehicles as Vehicle[]).filter(
              vehicle => vehicle.clientId === clientDraft.id
            ).length
          }
          onChange={setClientDraft}
          onClose={() => setClientDraft(null)}
          onSave={saveClient}
          onRemove={
            (ctx.data.clients as Client[]).some(
              client => client.id === clientDraft.id
            )
              ? () => removeClient(clientDraft)
              : undefined
          }
        />
      )}

      {vehicleDraft && (
        <VehicleForm
          draft={vehicleDraft}
          clients={sortByName<Client>(ctx.data.clients as Client[])}
          maxYear={maxVehicleYear}
          onChange={setVehicleDraft}
          onClose={() => setVehicleDraft(null)}
          onSave={saveVehicle}
          onRemove={
            (ctx.data.vehicles as Vehicle[]).some(
              vehicle => vehicle.id === vehicleDraft.id
            )
              ? () => removeVehicle(vehicleDraft)
              : undefined
          }
        />
      )}
    </main>
  );
}

function ClientList({
  clients,
  vehiclesByClient,
  selectedClientId,
  hasActiveFilters,
  onCreate,
  onEdit,
  onSelect,
  onViewVehicles,
}: {
  clients: Client[];
  vehiclesByClient: Map<string, Vehicle[]>;
  selectedClientId: string;
  hasActiveFilters: boolean;
  onCreate: () => void;
  onEdit: (client: Client) => void;
  onSelect: (clientId: string) => void;
  onViewVehicles: (client: Client) => void;
}) {
  if (!clients.length) {
    return (
      <EmptyState
        title={
          hasActiveFilters
            ? "Nenhum cliente encontrado"
            : "Nenhum cliente cadastrado"
        }
        description={
          hasActiveFilters
            ? "Ajuste a busca local ou global para ver outros registros."
            : "Comece pelo responsável do veículo. Os contatos podem ser preenchidos depois."
        }
        action={
          !hasActiveFilters ? (
            <Button variant="primary" onClick={onCreate}>
              <Plus size={18} aria-hidden="true" /> Cadastrar cliente
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <section className="grid grid-3" aria-label="Lista de clientes">
      {clients.map(client => {
        const vehicles = vehiclesByClient.get(client.id) ?? [];
        const selected = client.id === selectedClientId;
        return (
          <article
            className="card"
            key={client.id}
            data-testid={`client-card-${client.id}`}
          >
            <div className="card-head split">
              <div>
                <p className="eyebrow">{client.company || "Pessoa física"}</p>
                <h2>{clientName(client)}</h2>
              </div>
              {selected && <Badge tone="gold">Selecionado</Badge>}
            </div>
            <div className="card-body stack">
              <div className="key-value">
                <span>
                  <CarFront size={16} aria-hidden="true" /> Veículos
                </span>
                <strong>{vehicles.length}</strong>
              </div>
              {client.phone && (
                <p className="muted">
                  <Phone size={16} aria-hidden="true" /> {client.phone}
                </p>
              )}
              {client.email && (
                <p className="muted">
                  <Mail size={16} aria-hidden="true" /> {client.email}
                </p>
              )}
              {client.address && (
                <p className="muted">
                  <MapPin size={16} aria-hidden="true" /> {client.address}
                </p>
              )}
              {!client.phone && !client.email && (
                <p className="muted">Sem contatos informados.</p>
              )}
            </div>
            <footer className="card-footer row wrap">
              <Button variant="secondary" onClick={() => onSelect(client.id)}>
                <UsersRound size={16} aria-hidden="true" />{" "}
                {selected ? "Selecionado" : "Selecionar"}
              </Button>
              <Button variant="ghost" onClick={() => onViewVehicles(client)}>
                Ver veículos <ArrowRight size={16} aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                onClick={() => onEdit(client)}
                aria-label={`Editar ${clientName(client)}`}
              >
                <Pencil size={16} aria-hidden="true" /> Editar
              </Button>
            </footer>
          </article>
        );
      })}
    </section>
  );
}

function VehicleList({
  vehicles,
  clients,
  hasActiveFilters,
  onCreate,
  onEdit,
  onSelectOwner,
}: {
  vehicles: Vehicle[];
  clients: Client[];
  hasActiveFilters: boolean;
  onCreate: () => void;
  onEdit: (vehicle: Vehicle) => void;
  onSelectOwner: (clientId: string) => void;
}) {
  const clientsById = new Map(clients.map(client => [client.id, client]));

  if (!vehicles.length) {
    return (
      <EmptyState
        title={
          hasActiveFilters
            ? "Nenhum veículo encontrado"
            : "Nenhum veículo cadastrado"
        }
        description={
          hasActiveFilters
            ? "Revise os filtros e as buscas aplicadas."
            : "Cadastre um veículo e vincule-o a um cliente existente."
        }
        action={
          !hasActiveFilters ? (
            <Button variant="primary" onClick={onCreate}>
              <Plus size={18} aria-hidden="true" /> Cadastrar veículo
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <section className="table-wrap" aria-label="Lista de veículos">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Veículo</th>
            <th scope="col">Proprietário</th>
            <th scope="col">Identificação</th>
            <th scope="col">Cor</th>
            <th scope="col">
              <span className="muted">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {vehicles.map(vehicle => {
            const owner = clientsById.get(vehicle.clientId);
            return (
              <tr key={vehicle.id} data-testid={`vehicle-row-${vehicle.id}`}>
                <td>
                  <strong>
                    {vehicle.make} {vehicle.model}
                  </strong>
                  <span className="muted">Ano {vehicle.year}</span>
                </td>
                <td>
                  {owner ? (
                    <Button
                      variant="ghost"
                      onClick={() => onSelectOwner(owner.id)}
                    >
                      {clientName(owner)}
                    </Button>
                  ) : (
                    <Badge tone="warning">Vínculo pendente</Badge>
                  )}
                </td>
                <td>
                  <span>{vehicle.plate || "Placa não informada"}</span>
                  {vehicle.vin && (
                    <small className="muted">VIN {vehicle.vin}</small>
                  )}
                </td>
                <td>
                  {vehicle.color || (
                    <span className="muted">Não informada</span>
                  )}
                </td>
                <td>
                  <Button
                    variant="ghost"
                    onClick={() => onEdit(vehicle)}
                    aria-label={`Editar ${vehicle.make} ${vehicle.model}`}
                  >
                    <Pencil size={16} aria-hidden="true" /> Editar
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function ClientForm({
  draft,
  linkedVehicleCount,
  onChange,
  onClose,
  onSave,
  onRemove,
}: {
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

function VehicleForm({
  draft,
  clients,
  maxYear,
  onChange,
  onClose,
  onSave,
  onRemove,
}: {
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
