import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  PageHeading,
} from "../components/ui";
import JobDetails from "../components/JobDetails";
import {
  pipeline,
  transitionIssues,
  workflowForOrder,
  workflowPayment,
} from "../jobWorkflow";
import {
  categoryForCodes,
  findService,
  serviceCategories,
  type ServiceCategory,
} from "../serviceCatalog";
import { useGestor } from "../store";
import { dateLabel, money, services, vehicleLabel } from "../types";
import "../processStyles.css";

export default function ProductionPage() {
  const ctx = useGestor();
  const [category, setCategory] = useState<ServiceCategory | "all" | "legacy">(
    "all"
  );
  const [stageFilter, setStageFilter] = useState("all");
  const [deliveryFilter, setDeliveryFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const vehicles = useMemo(
    () => new Map(ctx.data.vehicles.map(vehicle => [vehicle.id, vehicle])),
    [ctx.data.vehicles]
  );
  // Every document is a job: a Lead / estimate is not excluded by approval status.
  const jobs = useMemo(
    () =>
      ctx.data.orders.map(order => ({
        order,
        workflow: workflowForOrder(order),
      })),
    [ctx.data.orders]
  );
  const selectedOrder = ctx.data.orders.find(order => order.id === selectedId);
  const visible = jobs.filter(({ order, workflow }) => {
    const query = ctx.search.trim().toLocaleLowerCase("pt-BR");
    const vehicle = order.vehicleId ? vehicles.get(order.vehicleId) : undefined;
    const text = [
      order.id,
      order.title,
      order.clientName,
      order.documentType,
      workflow.problem,
      workflow.packageCode,
      ...workflow.serviceCodes,
      ...workflow.serviceCodes.map(code => findService(code)?.name ?? ""),
      vehicleLabel(vehicle),
      vehicle?.color,
      order.serviceType ? services[order.serviceType]?.name : "",
    ]
      .join(" ")
      .toLocaleLowerCase("pt-BR");
    const delivered =
      workflow.stage === "delivered" || workflow.stage === "aftercare";
    return (
      (!query || text.includes(query)) &&
      (category === "all" ||
        (category === "legacy"
          ? !order.workflow
          : categoryForCodes(workflow.serviceCodes).includes(category))) &&
      (stageFilter === "all" || stageFilter === workflow.stage) &&
      (deliveryFilter === "all" ||
        (deliveryFilter === "delivered" ? delivered : !delivered))
    );
  });

  return (
    <section
      className="stack process-page"
      aria-label="Produção"
      aria-busy={ctx.loading}
    >
      <PageHeading
        eyebrow="Operação · pipeline universal"
        title="Produção"
        description="Todo job, do primeiro contato ao pós-venda. Estimativas, orçamentos e invoices no mesmo fluxo de nove etapas."
        action={
          <Button onClick={() => ctx.navigate("estimates")}>
            Novo orçamento
          </Button>
        }
      />
      {ctx.loading && (
        <p role="status" className="muted">
          Carregando trabalhos e processos…
        </p>
      )}
      {ctx.error && (
        <div className="error-message row wrap" role="alert">
          <span>{ctx.error}</span>
          <Button onClick={ctx.retry}>Tentar novamente</Button>
        </div>
      )}
      {!ctx.owner && (
        <p className="process-note">
          Acesso consultivo: apenas o responsável altera etapas, registros e
          anexos.
        </p>
      )}
      <div
        className="process-filters"
        role="search"
        aria-label="Pesquisar e filtrar trabalhos"
      >
        <Field label="Pesquisar" className="field-full">
          <input
            data-testid="production-search"
            type="search"
            value={ctx.search}
            onChange={event => ctx.setSearch(event.target.value)}
            placeholder="Job, cliente, veículo ou código de serviço"
          />
        </Field>
        <Field label="Categoria">
          <select
            data-testid="production-service-filter"
            value={category}
            onChange={event =>
              setCategory(event.target.value as typeof category)
            }
          >
            <option value="all">Todas as categorias</option>
            {Object.entries(serviceCategories).map(([code, name]) => (
              <option key={code} value={code}>
                {code} · {name}
              </option>
            ))}
            <option value="legacy">Registros legados</option>
          </select>
        </Field>
        <Field label="Etapa">
          <select
            value={stageFilter}
            onChange={event => setStageFilter(event.target.value)}
          >
            <option value="all">Todas as nove etapas</option>
            {pipeline.map(stage => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Entrega">
          <select
            data-testid="production-delivery-filter"
            value={deliveryFilter}
            onChange={event => setDeliveryFilter(event.target.value)}
          >
            <option value="all">Todos os trabalhos</option>
            <option value="open">Em andamento</option>
            <option value="delivered">Entregues / pós-venda</option>
          </select>
        </Field>
      </div>
      <nav className="process-stage-nav" aria-label="Resumo das nove etapas">
        {pipeline.map((stage, index) => (
          <button
            type="button"
            key={stage.id}
            className={`process-stage-pill${stageFilter === stage.id ? " is-selected" : ""}`}
            aria-pressed={stageFilter === stage.id}
            onClick={() =>
              setStageFilter(stageFilter === stage.id ? "all" : stage.id)
            }
          >
            <span className="mono">{index + 1}</span>
            <span>{stage.name}</span>
            <strong>
              {jobs.filter(job => job.workflow.stage === stage.id).length}
            </strong>
          </button>
        ))}
      </nav>
      {jobs.length === 0 && !ctx.loading ? (
        <EmptyState
          title="Nenhum job registrado"
          description="Crie uma estimativa ou orçamento para iniciar como Lead. Não é necessário aprovar antes de acompanhar o trabalho."
          action={
            <Button onClick={() => ctx.navigate("estimates")}>
              Novo orçamento
            </Button>
          }
        />
      ) : visible.length === 0 && !ctx.loading ? (
        <EmptyState
          title="Nenhum resultado para estes filtros"
          description="Ajuste a pesquisa, categoria, etapa ou entrega."
          action={
            <Button
              onClick={() => {
                ctx.setSearch("");
                setCategory("all");
                setStageFilter("all");
                setDeliveryFilter("all");
              }}
            >
              Limpar filtros
            </Button>
          }
        />
      ) : (
        <div className="process-board" aria-label="Quadro de nove etapas">
          {pipeline
            .filter(stage => stageFilter === "all" || stageFilter === stage.id)
            .map((stage, index) => {
              const stageJobs = visible.filter(
                job => job.workflow.stage === stage.id
              );
              return (
                <section
                  className="process-column"
                  key={stage.id}
                  data-testid={`production-column-${stage.id}`}
                  aria-labelledby={`production-stage-${stage.id}`}
                >
                  <header className="process-column-heading">
                    <div>
                      <p className="eyebrow">
                        Etapa{" "}
                        {pipeline.findIndex(item => item.id === stage.id) + 1} /
                        9
                      </p>
                      <h2 id={`production-stage-${stage.id}`}>{stage.name}</h2>
                      <p className="helper">{stage.detail}</p>
                    </div>
                    <Badge>{stageJobs.length}</Badge>
                  </header>
                  <div className="stack">
                    {stageJobs.length ? (
                      stageJobs.map(({ order, workflow }) => {
                        const next =
                          pipeline[
                            pipeline.findIndex(
                              item => item.id === workflow.stage
                            ) + 1
                          ];
                        const blockers =
                          order.workflow && next
                            ? transitionIssues(order, next.id, ctx.data)
                            : [];
                        const payment = workflowPayment(
                          workflow,
                          order.payments ?? []
                        );
                        return (
                          <article
                            className="process-job card"
                            key={order.id}
                            data-testid={`production-card-${order.id}`}
                          >
                            <div className="row wrap">
                              <Badge>{order.documentType}</Badge>
                              {!order.workflow && (
                                <Badge tone="warning">
                                  Legado · etapa inferida
                                </Badge>
                              )}
                              {workflow.packageCode && (
                                <Badge tone="gold">
                                  {workflow.packageCode}
                                </Badge>
                              )}
                            </div>
                            <div className="stack">
                              <h3>{order.title || "Job sem título"}</h3>
                              <p>
                                {order.clientName || "Cliente não informado"}
                              </p>
                              <p className="muted">
                                {vehicleLabel(
                                  order.vehicleId
                                    ? vehicles.get(order.vehicleId)
                                    : undefined
                                )}
                              </p>
                              <p className="process-codes">
                                {workflow.serviceCodes.length
                                  ? workflow.serviceCodes
                                      .map(
                                        code =>
                                          `${code} · ${findService(code)?.name ?? "Código desconhecido"}`
                                      )
                                      .join(" / ")
                                  : "Serviços oficiais ainda não vinculados"}
                              </p>
                            </div>
                            {order.workflow ? (
                              <div className="process-job-facts">
                                <p>
                                  <span>Orçado</span>
                                  <strong>
                                    {workflow.quotedAmount === null
                                      ? "Não definido"
                                      : money(
                                          workflow.quotedAmount,
                                          order.currency ??
                                            ctx.settings.currency
                                        )}
                                  </strong>
                                </p>
                                <p>
                                  <span>Saldo</span>
                                  <strong>
                                    {payment.balance === null
                                      ? "Não definido"
                                      : money(
                                          payment.balance,
                                          order.currency ??
                                            ctx.settings.currency
                                        )}
                                  </strong>
                                </p>
                                {workflow.promisedDate && (
                                  <p>
                                    <span>Entrega prometida</span>
                                    <strong>
                                      {dateLabel(workflow.promisedDate)}
                                    </strong>
                                  </p>
                                )}
                                <Badge
                                  tone={
                                    payment.status === "pago"
                                      ? "success"
                                      : "warning"
                                  }
                                >
                                  {payment.status}
                                </Badge>
                              </div>
                            ) : (
                              <p className="helper">
                                Histórico preservado. Abra os detalhes para
                                consultar o registro legado. Novos jobs utilizam
                                documentos com serviços oficiais.
                              </p>
                            )}
                            {blockers.length > 0 && (
                              <p className="helper process-blocked">
                                Próxima etapa: {blockers.length} pendência(s).{" "}
                                {blockers[0]}
                              </p>
                            )}
                            <Button
                              variant="secondary"
                              onClick={() => setSelectedId(order.id)}
                              aria-label={`Ver detalhes de ${order.title || order.id}`}
                            >
                              Ver detalhes
                              {next && order.workflow ? ` · ${next.name}` : ""}
                            </Button>
                          </article>
                        );
                      })
                    ) : (
                      <p className="muted process-column-empty">
                        Nenhum trabalho nesta etapa.
                      </p>
                    )}
                  </div>
                </section>
              );
            })}
        </div>
      )}
      {selectedOrder && (
        <JobDetails
          key={selectedOrder.id}
          order={selectedOrder}
          onClose={() => setSelectedId(null)}
        />
      )}
    </section>
  );
}
