import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  CarFront,
  FileDown,
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

import {
  ClientForm,
  VehicleForm,
  clientName,
  editableClient,
  newClient,
  newVehicle,
  normalizeClient,
  normalizeVehicle,
  splitName,
  type ClientDraft,
  type VehicleDraft,
} from "../components/ClientVehicleForms";

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

export default function CustomersPage() {
  const ctx = useGestor();
  const [localQuery, setLocalQuery] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [clientDraft, setClientDraft] = useState<ClientDraft | null>(null);
  const [vehicleDraft, setVehicleDraft] = useState<VehicleDraft | null>(null);
  const [vehicleOwnerFilter, setVehicleOwnerFilter] = useState("");
  const isVehicleView = ctx.view === "vehicles";
  useEffect(() => {
    try {
      if (sessionStorage.getItem("rw-open-new-client")) {
        sessionStorage.removeItem("rw-open-new-client");
        setClientDraft(newClient());
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
          onCheckin={async vehicle => {
            const owner = (ctx.data.clients as Client[]).find(
              c => c.id === vehicle.clientId
            );
            try {
              const { downloadCheckinPdf } = await import(
                "../../lib/checkinPdf"
              );
              await downloadCheckinPdf({
                studio: ctx.settings,
                customerName: owner ? clientName(owner) : "",
                customerPhone: owner?.phone,
                customerEmail: owner?.email,
                vehicle,
                date: new Date().toLocaleDateString("en-US"),
              });
            } catch {
              ctx.notify("Não foi possível gerar a ficha de check-in.", "error");
            }
          }}
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
  onCheckin,
}: {
  vehicles: Vehicle[];
  clients: Client[];
  hasActiveFilters: boolean;
  onCreate: () => void;
  onEdit: (vehicle: Vehicle) => void;
  onSelectOwner: (clientId: string) => void;
  onCheckin: (vehicle: Vehicle) => void;
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
                  <Button
                    variant="ghost"
                    onClick={() => onCheckin(vehicle)}
                    aria-label={`Ficha de check-in ${vehicle.make} ${vehicle.model}`}
                  >
                    <FileDown size={16} aria-hidden="true" /> Check-in
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
