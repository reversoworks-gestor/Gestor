import { useMemo } from "react";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FilePlus2,
  Gauge,
  PackageSearch,
  Plus,
  SearchCheck,
  ShieldAlert,
  UsersRound,
  Wrench,
} from "lucide-react";
import { Badge, Button, EmptyState, PageHeading } from "../components/ui";
import { useGestor } from "../store";
import {
  dateLabel,
  journey,
  money,
  services,
  vehicleLabel,
  type Assessment,
  type JourneyStage,
  type StudioOrder,
} from "../types";

const stageTone: Record<
  JourneyStage,
  "neutral" | "gold" | "warning" | "success"
> = {
  evaluate: "warning",
  define: "gold",
  develop: "gold",
  execute: "neutral",
  check: "success",
};

function dateTime(value: string) {
  if (!value) return Number.POSITIVE_INFINITY;
  const normalized = value.length === 10 ? `${value}T12:00:00` : value;
  const result = new Date(normalized).getTime();
  return Number.isFinite(result) ? result : Number.POSITIVE_INFINITY;
}

function orderJourneyStage(order: StudioOrder): JourneyStage {
  if (order.journeyStage) return order.journeyStage;
  if (order.productionStage === "planning") return "evaluate";
  if (order.productionStage === "approval") return "define";
  if (order.productionStage === "production") return "execute";
  if (
    order.productionStage === "quality" ||
    order.productionStage === "shipping"
  )
    return "check";
  return "evaluate";
}

function serviceName(serviceType?: keyof typeof services) {
  return serviceType ? services[serviceType].name : "Serviço a definir";
}

function assessmentTone(
  assessment: Assessment
): "neutral" | "gold" | "warning" | "success" | "danger" {
  if (assessment.verdict === "Não indicado") return "danger";
  if (assessment.verdict === "Viável") return "success";
  if (assessment.verdict === "Requer inspeção") return "warning";
  return "neutral";
}

export default function DashboardPage() {
  const { data, loading, navigate, settings } = useGestor();

  const dashboard = useMemo(() => {
    const clientById = new Map(data.clients.map(client => [client.id, client]));
    const vehicleById = new Map(
      data.vehicles.map(vehicle => [vehicle.id, vehicle])
    );
    const inJourney = data.orders.filter(
      order =>
        !order.completed &&
        order.documentType === "Invoice" &&
        (order.status === "Aprovado" || order.status === "Em produção")
    );
    const inspectionQueue = data.triages.filter(
      assessment =>
        assessment.verdict === "Pendente" ||
        assessment.verdict === "Requer inspeção"
    );
    const approvedValue = data.orders
      .filter(
        order =>
          order.documentType === "Invoice" &&
          (order.currency ?? "USD") === settings.currency &&
          (order.status === "Aprovado" || order.status === "Em produção")
      )
      .reduce(
        (sum, order) => sum + (Number.isFinite(order.total) ? order.total : 0),
        0
      );
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const upcomingEvents = data.calendar
      .filter(event => dateTime(event.date) >= now.getTime())
      .sort((left, right) => dateTime(left.date) - dateTime(right.date))
      .slice(0, 5);
    const stageOrders = journey.map(stage => ({
      ...stage,
      orders: inJourney
        .filter(order => orderJourneyStage(order) === stage.id)
        .slice(0, 4),
    }));
    const assessments = [...data.triages]
      .sort(
        (left, right) =>
          dateTime(right.updatedAt || right.createdAt) -
          dateTime(left.updatedAt || left.createdAt)
      )
      .slice(0, 5);
    const lowStock = data.materials.filter(
      material => material.availableGrams <= material.reorderAtGrams
    );

    return {
      clientById,
      vehicleById,
      inJourney,
      inspectionQueue,
      approvedValue,
      upcomingEvents,
      stageOrders,
      assessments,
      lowStock,
    };
  }, [data, settings.currency]);

  const nextEvent = dashboard.upcomingEvents[0];

  return (
    <div className="dashboard-page stack">
      <PageHeading
        eyebrow="Operação em andamento"
        title="Visão geral"
        description="Acompanhe a jornada de atendimento, a agenda e os pontos que pedem decisão da equipe."
        action={
          <div className="row wrap page-actions">
            <Button variant="secondary" onClick={() => navigate("calendar")}>
              <CalendarDays size={17} /> Abrir agenda
            </Button>
            <Button variant="primary" onClick={() => navigate("triage")}>
              <Plus size={17} /> Nova avaliação
            </Button>
          </div>
        }
      />

      {loading && (
        <p className="loading-note" role="status">
          Atualizando dados da operação…
        </p>
      )}

      <section className="metric-grid" aria-label="Indicadores operacionais">
        <article className="stat">
          <div className="stat-icon">
            <Wrench size={19} aria-hidden="true" />
          </div>
          <div>
            <p className="stat-label">Em jornada</p>
            <p className="stat-value">{dashboard.inJourney.length}</p>
            <p className="helper">Pedidos aprovados ou em execução</p>
          </div>
        </article>
        <article className="stat">
          <div className="stat-icon">
            <SearchCheck size={19} aria-hidden="true" />
          </div>
          <div>
            <p className="stat-label">Aguardando avaliação</p>
            <p className="stat-value">{dashboard.inspectionQueue.length}</p>
            <p className="helper">Pendentes ou requerem inspeção</p>
          </div>
        </article>
        <article className="stat">
          <div className="stat-icon">
            <Gauge size={19} aria-hidden="true" />
          </div>
          <div>
            <p className="stat-label">Volume aprovado</p>
            <p className="stat-value stat-value-money">
              {money(dashboard.approvedValue, settings.currency)}
            </p>
            <p className="helper">Pedidos aprovados e em produção</p>
          </div>
        </article>
        <article className="stat">
          <div className="stat-icon">
            <CalendarDays size={19} aria-hidden="true" />
          </div>
          <div>
            <p className="stat-label">Próximo evento</p>
            <p className="stat-value stat-value-date">
              {nextEvent ? dateLabel(nextEvent.date) : "—"}
            </p>
            <p className="helper">
              {nextEvent ? nextEvent.title : "Nenhum evento futuro registrado"}
            </p>
          </div>
        </article>
      </section>

      <section
        className="card dashboard-section"
        aria-labelledby="journey-heading"
      >
        <div className="card-head split">
          <div>
            <p className="eyebrow">Método Reverso</p>
            <h2 id="journey-heading">Jornada de atendimento e produção</h2>
          </div>
          <Button variant="ghost" onClick={() => navigate("production")}>
            Ver produção <ArrowRight size={16} />
          </Button>
        </div>
        <div
          className="journey-board"
          aria-label="Pedidos distribuídos pela jornada"
        >
          {dashboard.stageOrders.map(stage => (
            <section
              className="journey-column"
              key={stage.id}
              aria-labelledby={`stage-${stage.id}`}
            >
              <div className="journey-column-head">
                <Badge tone={stageTone[stage.id]}>{stage.name}</Badge>
                <span className="mono muted">{stage.orders.length}</span>
              </div>
              <p id={`stage-${stage.id}`} className="journey-detail">
                {stage.detail}
              </p>
              <div className="stack journey-jobs">
                {stage.orders.length ? (
                  stage.orders.map(order => {
                    const vehicle = order.vehicleId
                      ? dashboard.vehicleById.get(order.vehicleId)
                      : undefined;
                    const client = dashboard.clientById.get(order.clientId);
                    return (
                      <button
                        type="button"
                        className="job-card"
                        key={order.id}
                        onClick={() => navigate("production")}
                        aria-label={`Abrir produção de ${order.title}`}
                      >
                        <strong>{order.title || "Pedido sem título"}</strong>
                        <span>
                          {vehicle
                            ? vehicleLabel(vehicle)
                            : client?.name ||
                              order.clientName ||
                              "Cliente não informado"}
                        </span>
                        <small>{serviceName(order.serviceType)}</small>
                      </button>
                    );
                  })
                ) : (
                  <p className="journey-empty">Nenhum pedido nesta etapa.</p>
                )}
              </div>
            </section>
          ))}
        </div>
      </section>

      <div className="grid grid-2 dashboard-pairs">
        <section className="card" aria-labelledby="appointments-heading">
          <div className="card-head split">
            <div>
              <p className="eyebrow">Atendimentos</p>
              <h2 id="appointments-heading">Avaliações recentes</h2>
            </div>
            <Button variant="ghost" onClick={() => navigate("triage")}>
              Ver todas <ArrowRight size={16} />
            </Button>
          </div>
          <div className="card-body">
            {dashboard.assessments.length ? (
              <ul className="list assessment-list">
                {dashboard.assessments.map(assessment => {
                  const vehicle = dashboard.vehicleById.get(
                    assessment.vehicleId
                  );
                  const client = dashboard.clientById.get(assessment.clientId);
                  return (
                    <li key={assessment.id}>
                      <button
                        type="button"
                        className="list-row list-row-action"
                        onClick={() => navigate("triage")}
                      >
                        <span className="list-row-main">
                          <strong>
                            {assessment.title ||
                              serviceName(assessment.serviceType)}
                          </strong>
                          <span>
                            {vehicle
                              ? vehicleLabel(vehicle)
                              : client?.name || "Vínculo de veículo pendente"}
                          </span>
                        </span>
                        <span className="list-row-meta">
                          {assessment.safetyCritical && (
                            <ShieldAlert
                              size={16}
                              aria-label="Atenção: item potencialmente crítico"
                            />
                          )}
                          <Badge tone={assessmentTone(assessment)}>
                            {assessment.verdict}
                          </Badge>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                title="Nenhuma avaliação registrada"
                description="Registre condição, objetivo e limitações antes de definir um escopo."
                action={
                  <Button
                    variant="secondary"
                    onClick={() => navigate("triage")}
                  >
                    <Plus size={16} /> Registrar avaliação
                  </Button>
                }
              />
            )}
          </div>
        </section>

        <section className="card" aria-labelledby="calendar-heading">
          <div className="card-head split">
            <div>
              <p className="eyebrow">Agenda</p>
              <h2 id="calendar-heading">Próximos eventos</h2>
            </div>
            <Button variant="ghost" onClick={() => navigate("calendar")}>
              Ver agenda <ArrowRight size={16} />
            </Button>
          </div>
          <div className="card-body">
            {dashboard.upcomingEvents.length ? (
              <ul className="list event-list">
                {dashboard.upcomingEvents.map(event => (
                  <li key={event.id}>
                    <button
                      type="button"
                      className="list-row list-row-action"
                      onClick={() => navigate("calendar")}
                    >
                      <span className="event-date">
                        <span>{dateLabel(event.date)}</span>
                      </span>
                      <span className="list-row-main">
                        <strong>{event.title}</strong>
                        <span>{event.detail || "Sem detalhes adicionais"}</span>
                      </span>
                      <ArrowRight size={17} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="Agenda livre"
                description="Eventos de avaliação, pedidos e manutenção aparecerão aqui."
                action={
                  <Button
                    variant="secondary"
                    onClick={() => navigate("calendar")}
                  >
                    <CalendarDays size={16} /> Abrir agenda
                  </Button>
                }
              />
            )}
          </div>
        </section>
      </div>

      <div className="grid grid-2 dashboard-pairs">
        <section className="card" aria-labelledby="services-heading">
          <div className="card-head">
            <p className="eyebrow">Book de serviços</p>
            <h2 id="services-heading">Especialidades atendidas</h2>
          </div>
          <div className="card-body service-grid">
            {Object.entries(services).map(([key, service]) => (
              <article className="service-card" key={key}>
                <div className="service-card-icon">
                  <Wrench size={18} aria-hidden="true" />
                </div>
                <div>
                  <h3>{service.name}</h3>
                  <p>{service.limit}</p>
                </div>
                <Button variant="ghost" onClick={() => navigate("triage")}>
                  Iniciar avaliação <ArrowRight size={15} />
                </Button>
              </article>
            ))}
          </div>
        </section>

        <section className="card" aria-labelledby="next-steps-heading">
          <div className="card-head">
            <p className="eyebrow">Prioridades</p>
            <h2 id="next-steps-heading">Próximos passos</h2>
          </div>
          <div className="card-body">
            <ul className="list next-steps-list">
              {dashboard.inspectionQueue.length > 0 && (
                <li className="list-row">
                  <SearchCheck size={18} aria-hidden="true" />
                  <span className="list-row-main">
                    <strong>
                      {dashboard.inspectionQueue.length} avaliação(ões) pede(m)
                      definição
                    </strong>
                    <span>
                      Registre inspeção, limitações e parecer antes de aprovar o
                      escopo.
                    </span>
                  </span>
                  <Button variant="ghost" onClick={() => navigate("triage")}>
                    Abrir
                  </Button>
                </li>
              )}
              {dashboard.lowStock.length > 0 && (
                <li className="list-row">
                  <PackageSearch size={18} aria-hidden="true" />
                  <span className="list-row-main">
                    <strong>
                      {dashboard.lowStock.length} material(is) no ponto de
                      reposição
                    </strong>
                    <span>
                      Confira quantidade física e a necessidade antes de
                      reservar novos pedidos.
                    </span>
                  </span>
                  <Button variant="ghost" onClick={() => navigate("inventory")}>
                    Estoque
                  </Button>
                </li>
              )}
              {dashboard.inJourney.length > 0 && (
                <li className="list-row">
                  <ClipboardCheck size={18} aria-hidden="true" />
                  <span className="list-row-main">
                    <strong>Acompanhar pedidos em jornada</strong>
                    <span>
                      Revise escopo aprovado, etapa atual e próximas
                      verificações.
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    onClick={() => navigate("production")}
                  >
                    Produção
                  </Button>
                </li>
              )}
              {!dashboard.inspectionQueue.length &&
                !dashboard.lowStock.length &&
                !dashboard.inJourney.length && (
                  <li>
                    <EmptyState
                      title="Sem pendências operacionais"
                      description="À medida que a operação receber registros, os próximos passos serão listados aqui."
                    />
                  </li>
                )}
            </ul>
          </div>
        </section>
      </div>

      <section
        className="card evidence-card"
        aria-labelledby="evidence-heading"
      >
        <div className="card-head split">
          <div>
            <p className="eyebrow">Rastreabilidade</p>
            <h2 id="evidence-heading">Evidências e limites de avaliação</h2>
          </div>
          <Button variant="secondary" onClick={() => navigate("estimates")}>
            <FilePlus2 size={17} /> Novo orçamento
          </Button>
        </div>
        <div className="card-body evidence-grid">
          <div className="evidence-item">
            <CheckCircle2 size={19} aria-hidden="true" />
            <div>
              <strong>Fotos apoiam a triagem, não a validação técnica.</strong>
              <p>
                Condições, interfaces, montagem e requisitos da aplicação devem
                ser registrados e avaliados no atendimento.
              </p>
            </div>
          </div>
          <div className="evidence-item">
            <ShieldAlert size={19} aria-hidden="true" />
            <div>
              <strong>Itens críticos exigem verificação apropriada.</strong>
              <p>
                O Gestor mantém o parecer e as limitações documentados; não
                presume aptidão de componentes ou materiais.
              </p>
            </div>
          </div>
          <div className="evidence-item">
            <UsersRound size={19} aria-hidden="true" />
            <div>
              <strong>Escopo depende de aprovação registrada.</strong>
              <p>
                Use a jornada para associar a necessidade, o veículo, as
                premissas e a conferência antes da entrega.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
