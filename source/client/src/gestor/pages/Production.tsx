import { type DragEvent, type FormEvent, useMemo, useState } from "react";

import {
  Badge,
  Button,
  EmptyState,
  Field,
  Modal,
  PageHeading,
  useAction,
} from "../components/ui";
import { useGestor } from "../store";
import {
  dateLabel,
  journey,
  services,
  type JourneyStage,
  type StudioOrder,
  vehicleLabel,
} from "../types";

type DeliveryFilter = "all" | "open" | "delivered";
type ServiceFilter =
  | "all"
  | "unassigned"
  | NonNullable<StudioOrder["serviceType"]>;

type OrderDraft = {
  scope: string;
  constraints: string;
  inspectionNotes: string;
  clientApproved: boolean;
  fitApproved: boolean;
  finishApproved: boolean;
  completed: boolean;
};

const approvedStatuses = new Set<StudioOrder["status"]>([
  "Aprovado",
  "Em produção",
]);

function isProductionOrder(order: StudioOrder): boolean {
  if (order.documentType === "Invoice") return true;

  return (
    order.documentType === "Orçamento" && approvedStatuses.has(order.status)
  );
}

function stageForOrder(order: StudioOrder): JourneyStage {
  return order.journeyStage ?? "evaluate";
}

function draftFromOrder(order: StudioOrder): OrderDraft {
  return {
    scope: order.scope ?? "",
    constraints: order.constraints ?? "",
    inspectionNotes: order.inspectionNotes ?? "",
    clientApproved: Boolean(order.clientApproved),
    fitApproved: Boolean(order.fitApproved),
    finishApproved: Boolean(order.finishApproved),
    completed: Boolean(order.completed),
  };
}

function canBeDelivered(order: StudioOrder, draft: OrderDraft): boolean {
  return (
    stageForOrder(order) === "check" &&
    draft.clientApproved &&
    draft.fitApproved &&
    draft.finishApproved &&
    draft.inspectionNotes.trim().length > 0
  );
}

function orderMatchesSearch(
  order: StudioOrder,
  vehicleName: string,
  query: string
): boolean {
  if (!query.trim()) return true;

  const searchableText = [
    order.id,
    order.title,
    order.clientName,
    order.documentType,
    order.status,
    order.materialName,
    order.scope,
    order.constraints,
    vehicleName,
    order.serviceType ? services[order.serviceType].name : "",
  ]
    .join(" ")
    .toLocaleLowerCase("pt-BR");

  return searchableText.includes(query.trim().toLocaleLowerCase("pt-BR"));
}

function orderBadgeTone(
  order: StudioOrder
): "gold" | "success" | "warning" | "neutral" {
  if (order.completed) return "success";
  if (order.status === "Em produção") return "gold";
  if (order.status === "Aprovado") return "success";
  return "neutral";
}

export default function ProductionPage() {
  const ctx = useGestor();
  const action = useAction();
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>("all");
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryFilter>("all");
  const [draggedOrderId, setDraggedOrderId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [draft, setDraft] = useState<OrderDraft | null>(null);

  const vehiclesById = useMemo(
    () => new Map(ctx.data.vehicles.map(vehicle => [vehicle.id, vehicle])),
    [ctx.data.vehicles]
  );

  const productionOrders = useMemo(
    () => ctx.data.orders.filter(isProductionOrder),
    [ctx.data.orders]
  );

  const selectedOrder = useMemo(
    () => productionOrders.find(order => order.id === selectedOrderId) ?? null,
    [productionOrders, selectedOrderId]
  );

  const visibleOrders = useMemo(
    () =>
      productionOrders.filter(order => {
        const vehicleName = vehicleLabel(
          order.vehicleId ? vehiclesById.get(order.vehicleId) : undefined
        );
        const matchesService =
          serviceFilter === "all" ||
          (serviceFilter === "unassigned"
            ? !order.serviceType
            : order.serviceType === serviceFilter);
        const matchesDelivery =
          deliveryFilter === "all" ||
          (deliveryFilter === "delivered"
            ? Boolean(order.completed)
            : !order.completed);

        return (
          matchesService &&
          matchesDelivery &&
          orderMatchesSearch(order, vehicleName, ctx.search)
        );
      }),
    [ctx.search, deliveryFilter, productionOrders, serviceFilter, vehiclesById]
  );

  const hasFilters =
    Boolean(ctx.search.trim()) ||
    serviceFilter !== "all" ||
    deliveryFilter !== "all";

  const openOrder = (order: StudioOrder) => {
    setSelectedOrderId(order.id);
    setDraft(draftFromOrder(order));
  };

  const closeOrder = () => {
    setSelectedOrderId(null);
    setDraft(null);
  };

  const moveOrderToStage = (order: StudioOrder, stage: JourneyStage) => {
    if (stageForOrder(order) === stage) return;

    void action.run(
      async () => {
        const shouldReopenDelivery =
          Boolean(order.completed) &&
          !canBeDelivered(
            { ...order, journeyStage: stage },
            draftFromOrder(order)
          );
        const orderForMove = shouldReopenDelivery
          ? { ...order, completed: false }
          : order;

        if (shouldReopenDelivery) {
          await ctx.saveOrder(orderForMove);
        }

        await ctx.moveOrder(orderForMove, stage);

        if (shouldReopenDelivery) {
          setDraft(current =>
            current ? { ...current, completed: false } : current
          );
        }
      },
      movingBackFromDeliveryMessage(order, stage)
    );
  };

  const handleDragStart = (
    event: DragEvent<HTMLElement>,
    order: StudioOrder
  ) => {
    setDraggedOrderId(order.id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", order.id);
  };

  const handleDrop = (event: DragEvent<HTMLElement>, stage: JourneyStage) => {
    event.preventDefault();
    const orderId = event.dataTransfer.getData("text/plain") || draggedOrderId;
    setDraggedOrderId(null);

    if (!orderId) return;
    const order = productionOrders.find(candidate => candidate.id === orderId);
    if (order) moveOrderToStage(order, stage);
  };

  const buildOrderFromDraft = (
    order: StudioOrder,
    currentDraft: OrderDraft,
    completed: boolean
  ): StudioOrder => ({
    ...order,
    scope: currentDraft.scope.trim(),
    constraints: currentDraft.constraints.trim(),
    inspectionNotes: currentDraft.inspectionNotes.trim(),
    clientApproved: currentDraft.clientApproved,
    fitApproved: currentDraft.fitApproved,
    finishApproved: currentDraft.finishApproved,
    completed,
  });

  const saveDetails = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedOrder || !draft) return;

    const deliveryIsValid = canBeDelivered(selectedOrder, draft);
    const shouldRemainDelivered = draft.completed && deliveryIsValid;
    const orderToSave = buildOrderFromDraft(
      selectedOrder,
      draft,
      shouldRemainDelivered
    );

    void action.run(
      async () => {
        await ctx.saveOrder(orderToSave);
        setDraft(draftFromOrder(orderToSave));
      },
      shouldRemainDelivered
        ? "Verificações e entrega atualizadas."
        : "Dados de produção atualizados."
    );
  };

  const markDelivered = () => {
    if (!selectedOrder || !draft) return;

    if (!canBeDelivered(selectedOrder, draft)) {
      ctx.notify(
        "Registre a aprovação do cliente, montagem, acabamento e as notas de inspeção antes de marcar a entrega.",
        "error"
      );
      return;
    }

    const deliveredOrder = buildOrderFromDraft(selectedOrder, draft, true);
    void action.run(async () => {
      await ctx.saveOrder(deliveredOrder);
      setDraft(draftFromOrder(deliveredOrder));
    }, "Entrega registrada após as verificações.");
  };

  if (ctx.loading) {
    return (
      <section className="stack" aria-busy="true" aria-live="polite">
        <PageHeading
          eyebrow="Operação"
          title="Produção"
          description="Carregando jornada operacional."
        />
        <p className="muted">Carregando invoices e pedidos autorizados…</p>
      </section>
    );
  }

  return (
    <section className="stack" aria-label="Produção">
      <PageHeading
        eyebrow="Operação"
        title="Produção"
        description="Acompanhe apenas invoices e pedidos autorizados da avaliação à conferência."
      />

      {ctx.error ? (
        <div className="error-message row wrap" role="alert">
          <span>{ctx.error}</span>
          <Button type="button" variant="secondary" onClick={ctx.retry}>
            Tentar novamente
          </Button>
        </div>
      ) : null}

      <div
        className="toolbar"
        role="search"
        aria-label="Pesquisar e filtrar produção"
      >
        <Field label="Pesquisar" className="field-full">
          <input
            id="production-search"
            data-testid="production-search"
            type="search"
            value={ctx.search}
            onChange={event => ctx.setSearch(event.target.value)}
            placeholder="Pedido, invoice, cliente, veículo ou serviço"
          />
        </Field>

        <Field label="Serviço">
          <select
            id="production-service-filter"
            data-testid="production-service-filter"
            value={serviceFilter}
            onChange={event =>
              setServiceFilter(event.target.value as ServiceFilter)
            }
          >
            <option value="all">Todos os serviços</option>
            {Object.entries(services).map(([id, service]) => (
              <option key={id} value={id}>
                {service.name}
              </option>
            ))}
            <option value="unassigned">Serviço a definir</option>
          </select>
        </Field>

        <Field label="Entrega">
          <select
            id="production-delivery-filter"
            data-testid="production-delivery-filter"
            value={deliveryFilter}
            onChange={event =>
              setDeliveryFilter(event.target.value as DeliveryFilter)
            }
          >
            <option value="all">Todas</option>
            <option value="open">Em andamento</option>
            <option value="delivered">Entregues</option>
          </select>
        </Field>
      </div>

      {action.error ? (
        <p className="error-message" role="alert">
          {action.error}
        </p>
      ) : null}

      {productionOrders.length === 0 ? (
        <EmptyState
          title="Nenhum trabalho ativo na produção"
          description="Invoices e pedidos autorizados aparecerão aqui. Estimativas sem aprovação não entram na jornada operacional."
        />
      ) : visibleOrders.length === 0 ? (
        <EmptyState
          title="Nenhum resultado para estes filtros"
          description="Ajuste a pesquisa, o serviço ou o estado de entrega para visualizar os trabalhos autorizados."
          action={
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                ctx.setSearch("");
                setServiceFilter("all");
                setDeliveryFilter("all");
              }}
              disabled={!hasFilters}
            >
              Limpar filtros
            </Button>
          }
        />
      ) : (
        <div
          className="journey-board"
          aria-label="Quadro da jornada de produção"
        >
          {journey.map(journeyStage => {
            const columnOrders = visibleOrders.filter(
              order => stageForOrder(order) === journeyStage.id
            );

            return (
              <section
                key={journeyStage.id}
                className={`journey-column${draggedOrderId ? " active" : ""}`}
                aria-labelledby={`stage-${journeyStage.id}`}
                data-testid={`production-column-${journeyStage.id}`}
                onDragOver={event => event.preventDefault()}
                onDrop={event => handleDrop(event, journeyStage.id)}
              >
                <header className="card-head">
                  <div>
                    <h2 id={`stage-${journeyStage.id}`}>{journeyStage.name}</h2>
                    <p className="muted">{journeyStage.detail}</p>
                  </div>
                  <Badge tone="neutral">{columnOrders.length}</Badge>
                </header>

                <div className="stack" aria-live="polite">
                  {columnOrders.length === 0 ? (
                    <p className="muted">Nenhum trabalho nesta etapa.</p>
                  ) : (
                    columnOrders.map(order => {
                      const vehicle = order.vehicleId
                        ? vehiclesById.get(order.vehicleId)
                        : undefined;
                      const vehicleName = vehicleLabel(vehicle);
                      const service = order.serviceType
                        ? services[order.serviceType]
                        : undefined;
                      const deliveryReady = canBeDelivered(
                        order,
                        draftFromOrder(order)
                      );
                      const inconsistentDelivery =
                        Boolean(order.completed) && !deliveryReady;

                      return (
                        <article
                          key={order.id}
                          className="job-card"
                          draggable
                          data-testid={`production-card-${order.id}`}
                          onDragStart={event => handleDragStart(event, order)}
                          onDragEnd={() => setDraggedOrderId(null)}
                        >
                          <div className="card-head row wrap">
                            <Badge tone={orderBadgeTone(order)}>
                              {order.documentType === "Invoice"
                                ? "Invoice"
                                : "Pedido autorizado"}
                            </Badge>
                            {order.completed ? (
                              <Badge tone="success">Entregue</Badge>
                            ) : null}
                          </div>

                          <div className="card-body stack">
                            <div>
                              <h3>{order.title || "Serviço sem título"}</h3>
                              <p className="muted">
                                {order.clientName || "Cliente não informado"}
                              </p>
                            </div>
                            <p>{vehicleName}</p>
                            <p className="muted">
                              {service?.name ?? "Serviço a definir"}
                            </p>
                            {order.scope ? (
                              <p>{order.scope}</p>
                            ) : (
                              <p className="muted">
                                Escopo ainda não registrado.
                              </p>
                            )}
                            {order.dueDate ? (
                              <p className="muted">
                                Prazo: {dateLabel(order.dueDate)}
                              </p>
                            ) : null}
                            {inconsistentDelivery ? (
                              <p className="error-message" role="status">
                                Entrega requer revisão das verificações.
                              </p>
                            ) : null}
                          </div>

                          <div className="card-footer stack">
                            <Field label="Etapa da jornada">
                              <select
                                aria-label={`Mover ${order.title || order.id} para uma etapa`}
                                data-testid={`production-stage-${order.id}`}
                                value={stageForOrder(order)}
                                disabled={action.busy}
                                onChange={event =>
                                  moveOrderToStage(
                                    order,
                                    event.target.value as JourneyStage
                                  )
                                }
                              >
                                {journey.map(option => (
                                  <option key={option.id} value={option.id}>
                                    {option.name}
                                  </option>
                                ))}
                              </select>
                            </Field>
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => openOrder(order)}
                            >
                              Ver detalhes
                            </Button>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {selectedOrder && draft ? (
        <Modal
          title={`Produção · ${selectedOrder.title || "Serviço sem título"}`}
          onClose={closeOrder}
          footer={
            <div className="row wrap">
              <Button
                type="button"
                variant="ghost"
                onClick={closeOrder}
                disabled={action.busy}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={markDelivered}
                disabled={
                  action.busy ||
                  draft.completed ||
                  !canBeDelivered(selectedOrder, draft)
                }
              >
                {draft.completed
                  ? "Entrega registrada"
                  : "Marcar como entregue"}
              </Button>
              <Button
                type="submit"
                form="production-order-form"
                variant="primary"
                disabled={action.busy}
              >
                Salvar alterações
              </Button>
            </div>
          }
        >
          <form
            id="production-order-form"
            className="stack"
            onSubmit={saveDetails}
          >
            {action.error ? (
              <p className="error-message" role="alert">
                {action.error}
              </p>
            ) : null}

            <div className="details-grid">
              <div className="key-value">
                <span>Veículo</span>
                <strong>
                  {vehicleLabel(
                    selectedOrder.vehicleId
                      ? vehiclesById.get(selectedOrder.vehicleId)
                      : undefined
                  )}
                </strong>
              </div>
              <div className="key-value">
                <span>Serviço</span>
                <strong>
                  {selectedOrder.serviceType
                    ? services[selectedOrder.serviceType].name
                    : "Serviço a definir"}
                </strong>
              </div>
              <div className="key-value">
                <span>Etapa</span>
                <strong>
                  {
                    journey.find(
                      item => item.id === stageForOrder(selectedOrder)
                    )?.name
                  }
                </strong>
              </div>
            </div>

            <Field
              label="Escopo aprovado"
              help="Descreva o que será executado neste pedido."
            >
              <textarea
                id="production-scope"
                value={draft.scope}
                onChange={event =>
                  setDraft(current =>
                    current
                      ? { ...current, scope: event.target.value }
                      : current
                  )
                }
                rows={4}
              />
            </Field>

            <Field
              label="Premissas e restrições"
              help="Registre limites técnicos, dependências ou pontos de atenção."
            >
              <textarea
                id="production-constraints"
                value={draft.constraints}
                onChange={event =>
                  setDraft(current =>
                    current
                      ? { ...current, constraints: event.target.value }
                      : current
                  )
                }
                rows={3}
              />
            </Field>

            <fieldset className="card">
              <legend>Verificações para entrega</legend>
              <div className="stack">
                <label className="row">
                  <input
                    type="checkbox"
                    checked={draft.clientApproved}
                    onChange={event =>
                      setDraft(current =>
                        current
                          ? { ...current, clientApproved: event.target.checked }
                          : current
                      )
                    }
                  />
                  Aprovação do cliente registrada
                </label>
                <label className="row">
                  <input
                    type="checkbox"
                    checked={draft.fitApproved}
                    onChange={event =>
                      setDraft(current =>
                        current
                          ? { ...current, fitApproved: event.target.checked }
                          : current
                      )
                    }
                  />
                  Montagem e ajuste conferidos
                </label>
                <label className="row">
                  <input
                    type="checkbox"
                    checked={draft.finishApproved}
                    onChange={event =>
                      setDraft(current =>
                        current
                          ? { ...current, finishApproved: event.target.checked }
                          : current
                      )
                    }
                  />
                  Acabamento aprovado
                </label>
              </div>
            </fieldset>

            <Field
              label="Notas da inspeção"
              help="Obrigatórias para registrar a entrega; descreva o que foi conferido e eventuais limites remanescentes."
            >
              <textarea
                id="production-inspection-notes"
                value={draft.inspectionNotes}
                onChange={event =>
                  setDraft(current =>
                    current
                      ? { ...current, inspectionNotes: event.target.value }
                      : current
                  )
                }
                rows={4}
              />
            </Field>

            {draft.completed && !canBeDelivered(selectedOrder, draft) ? (
              <p className="error-message" role="status">
                Esta entrega será desmarcada ao salvar até que a aprovação, as
                verificações e as notas estejam completas na etapa Conferir.
              </p>
            ) : null}

            {!draft.completed ? (
              <p className="helper" role="status">
                A entrega só pode ser marcada em Conferir, após aprovação do
                cliente, montagem, acabamento e notas de inspeção.
              </p>
            ) : null}
          </form>
        </Modal>
      ) : null}
    </section>
  );
}

function movingBackFromDeliveryMessage(
  order: StudioOrder,
  stage: JourneyStage
): string {
  const completionDraft = draftFromOrder(order);
  if (
    order.completed &&
    !canBeDelivered({ ...order, journeyStage: stage }, completionDraft)
  ) {
    return "Etapa atualizada; a entrega foi reaberta para manter as verificações consistentes.";
  }

  return "Etapa da jornada atualizada.";
}
