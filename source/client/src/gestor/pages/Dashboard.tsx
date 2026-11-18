import { useMemo } from "react";
import {
  ArrowRight,
  ChevronRight,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  FilePlus2,
  FileText,
  Gauge,
  PackageSearch,
  MessageSquare,
  Receipt,
  Search,
  UserPlus,
  Plus,
  SearchCheck,
  ShieldAlert,
  UsersRound,
  Wrench,
} from "lucide-react";
import { Badge, Button, EmptyState, PageHeading } from "../components/ui";
import { useGestor } from "../store";
import { pipeline, workflowForOrder, type PipelineStage } from "../jobWorkflow";
import { officialServices, serviceCategories } from "../serviceCatalog";
import "../processStyles.css";
import {
  dateLabel,
  money,
  services,
  vehicleLabel,
  type Assessment,
} from "../types";

const stageTone: Record<
  PipelineStage,
  "neutral" | "gold" | "warning" | "success"
> = {
  lead: "neutral",
  evaluation: "warning",
  quote: "gold",
  approved: "success",
  scheduled: "gold",
  production: "gold",
  quality: "warning",
  delivered: "success",
  aftercare: "success",
};

function dateTime(value: string) {
  if (!value) return Number.POSITIVE_INFINITY;
  const normalized = value.length === 10 ? `${value}T12:00:00` : value;
  const result = new Date(normalized).getTime();
  return Number.isFinite(result) ? result : Number.POSITIVE_INFINITY;
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
        !["delivered", "aftercare"].includes(workflowForOrder(order).stage)
    );
    const inspectionQueue = data.triages.filter(
      assessment =>
        assessment.verdict === "Pendente" ||
        assessment.verdict === "Requer inspeção"
    );
    const approvedJobs = data.orders.filter(
      order =>
        (order.currency ?? "USD") === settings.currency &&
        ["approved", "scheduled", "production", "quality"].includes(
          workflowForOrder(order).stage
        )
    );
    const approvedAmounts = approvedJobs
      .map(order =>
        order.workflow
          ? (order.workflow.finalAmount ?? order.workflow.quotedAmount)
          : Number.isFinite(order.total)
            ? order.total
            : null
      )
      .filter((amount): amount is number => amount !== null);
    const approvedValue = approvedAmounts.reduce(
      (sum, amount) => sum + amount,
      0
    );
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const upcomingEvents = data.calendar
      .filter(event => dateTime(event.date) >= now.getTime())
      .sort((left, right) => dateTime(left.date) - dateTime(right.date))
      .slice(0, 5);
    const stageOrders = pipeline.map(stage => ({
      ...stage,
      total: data.orders.filter(
        order => workflowForOrder(order).stage === stage.id
      ).length,
      orders: data.orders
        .filter(order => workflowForOrder(order).stage === stage.id)
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
      hasApprovedPricing: approvedAmounts.length > 0,
      upcomingEvents,
      stageOrders,
      assessments,
      lowStock,
    };
  }, [data, settings.currency]);

  const nextEvent = dashboard.upcomingEvents[0];
  const estimateCount = data.orders.filter(
    order => order.documentType !== "Invoice"
  ).length;
  const invoiceCount = data.orders.filter(
    order => order.documentType === "Invoice"
  ).length;
  const newClient = () => {
    try {
      sessionStorage.setItem("rw-open-new-client", "1");
    } catch {}
    navigate("clients");
  };
  const openSearch = () =>
    document
      .querySelector<HTMLButtonElement>(".compact-search-toggle")
      ?.click();

  return (
    <div className="dashboard-page stack process-dashboard">
      <PageHeading
        eyebrow="Operação em andamento"
        title="Reverso Works"
      />

      {loading && (
        <p className="loading-note" role="status">
          Atualizando dados da operação…
        </p>
      )}

      <section className="metric-grid kpi-grid" aria-label="Indicadores operacionais">
        <article className="stat stat-card kpi-estimates">
          <div className="kpi-art" aria-hidden="true">
            <svg viewBox="0 0 120 90" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 62c0-10 4-18 10-24l8-16c2-4 6-6 10-6h40c4 0 8 2 10 6l8 16c6 6 10 14 10 24v10c0 3-2 5-5 5h-8c-3 0-5-2-5-5v-3H30v3c0 3-2 5-5 5h-8c-3 0-5-2-5-5z" />
              <path d="M30 38h60M32 56l12 4h32l12-4" />
              <circle cx="32" cy="52" r="4" /><circle cx="88" cy="52" r="4" />
            </svg>
          </div>
          <header className="stat-head">
            <span className="stat-icon">
              <FileText size={19} aria-hidden="true" />
            </span>
            <p className="stat-label">Estimativas</p>
          </header>
          <p className="stat-value">{estimateCount}</p>
          <p className="helper">{dashboard.inJourney.length} em jornada · {dashboard.inspectionQueue.length} aguardando avaliação</p>
          <div className="stat-actions">
            <button type="button" onClick={() => navigate("estimates")}>
              <span><FileText size={15} aria-hidden="true" /> Estimativas</span>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => navigate("triage")}>
              <span><Plus size={15} aria-hidden="true" /> Avaliação</span>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </article>
        <article className="stat stat-card kpi-invoices">
          <div className="kpi-art" aria-hidden="true">
            <svg viewBox="0 0 120 90" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M34 8h40l16 16v58H34z" /><path d="M74 8v16h16" />
              <path d="M44 38h36M44 50h36M44 62h22" /><path d="M72 66l4 4 8-9" />
            </svg>
          </div>
          <header className="stat-head">
            <span className="stat-icon">
              <Receipt size={19} aria-hidden="true" />
            </span>
            <p className="stat-label">Invoices</p>
          </header>
          <p className="stat-value">{invoiceCount}</p>
          <p className="helper">Documentos de cobrança emitidos</p>
          <div className="stat-actions">
            <button type="button" onClick={() => navigate("invoices")}>
              <span><Receipt size={15} aria-hidden="true" /> Ver invoices</span>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
            <button type="button" onClick={openSearch}>
              <span><Search size={15} aria-hidden="true" /> Buscar cliente</span>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </article>
        <article className="stat stat-card kpi-volume">
          <div className="kpi-art" aria-hidden="true">
            <svg viewBox="0 0 120 90" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 80h92" /><path d="M28 80V58M50 80V46M72 80V34M94 80V20" strokeWidth="8" />
              <path d="M24 44l24-14 18 6 36-22" /><path d="M92 14h10v10" />
            </svg>
          </div>
          <header className="stat-head">
            <span className="stat-icon">
              <Gauge size={19} aria-hidden="true" />
            </span>
            <p className="stat-label">Volume aprovado</p>
          </header>
          <p className="stat-value stat-value-money">{dashboard.hasApprovedPricing
              ? money(dashboard.approvedValue, settings.currency)
              : "Não definido"}</p>
          <p className="helper">Valores explícitos · aprovados até qualidade</p>
          <div className="stat-actions">
            <button type="button" onClick={() => navigate("production")}>
              <span><ClipboardCheck size={15} aria-hidden="true" /> Ver jobs</span>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
            <button type="button" onClick={newClient}>
              <span><UserPlus size={15} aria-hidden="true" /> Novo cliente</span>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </article>
        <article className="stat stat-card kpi-event">
          <div className="kpi-art" aria-hidden="true">
            <svg viewBox="0 0 120 90" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="24" y="16" width="72" height="64" rx="6" /><path d="M24 36h72M42 8v14M78 8v14" />
              <path d="M38 50h6M57 50h6M76 50h6M38 64h6M57 64h6" strokeWidth="4" />
            </svg>
          </div>
          <header className="stat-head">
            <span className="stat-icon">
              <CalendarDays size={19} aria-hidden="true" />
            </span>
            <p className="stat-label">Próximo evento</p>
          </header>
          <p className="stat-value stat-value-date">{nextEvent ? dateLabel(nextEvent.date) : "—"}</p>
          <p className="helper">{nextEvent ? nextEvent.title : "Nenhum evento futuro registrado"}</p>
          <div className="stat-actions">
            <button type="button" onClick={() => navigate("calendar")}>
              <span><CalendarDays size={15} aria-hidden="true" /> Agenda</span>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => navigate("messages")}>
              <span><MessageSquare size={15} aria-hidden="true" /> Mensagens</span>
              <ChevronRight size={16} aria-hidden="true" />
            </button>
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
            <h2 id="journey-heading">Pipeline universal · 9 etapas</h2>
          </div>
          <Button variant="ghost" onClick={() => navigate("production")}>
            Ver todos os jobs <ArrowRight size={16} />
          </Button>
        </div>
        <div
          className="process-dashboard-board"
          aria-label="Pedidos distribuídos pela jornada"
        >
          {dashboard.stageOrders.map(stage => (
            <section
              className="process-dashboard-stage"
              key={stage.id}
              aria-labelledby={`stage-${stage.id}`}
            >
              <div className="journey-column-head">
                <Badge tone={stageTone[stage.id]}>{stage.name}</Badge>
                <span className="mono muted">{stage.total}</span>
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
                        <small>
                          {order.workflow
                            ? order.workflow.serviceCodes.join(" · ")
                            : `Legado · etapa inferida · ${serviceName(order.serviceType)}`}
                        </small>
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
            {Object.entries(serviceCategories).map(([key, name]) => (
              <article className="service-card" key={key}>
                <div className="service-card-icon">
                  <Wrench size={18} aria-hidden="true" />
                </div>
                <div>
                  <h3>
                    {key} · {name}
                  </h3>
                  <p>
                    {officialServices
                      .filter(service => service.category === key)
                      .map(service => service.code)
                      .join(" · ")}
                  </p>
                  <p className="helper">
                    Preço por avaliação · sem valores padrão
                  </p>
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
