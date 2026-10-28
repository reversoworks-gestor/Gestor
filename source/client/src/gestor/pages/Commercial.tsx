import { DateInput } from "../components/ui";
import { useMemo, useRef, useState, type ChangeEvent } from "react";
import type {
  Attachment,
  CatalogItem,
  Client,
  OrderLine,
  Payment,
} from "../../lib/models";
import { stripDownloadUrlToken } from "../../lib/attachments";
import {
  calculateOrderTotals,
  centsToAmount,
  toCents,
  validatePayments,
} from "../../lib/finance";
import {
  Badge,
  Button,
  ConfirmButton,
  EmptyState,
  Field,
  FormModal,
  PageHeading,
  useAction,
} from "../components/ui";
import { useGestor } from "../store";
import {
  makeId,
  money,
  services,
  today,
  type ServiceType,
  type StudioOrder,
} from "../types";

type CommercialFilter = "estimates" | "invoices" | "orders";
type DocumentType = StudioOrder["documentType"];

const MAX_ATTACHMENT_SIZE = 15 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = new Set(["pdf", "png", "jpg", "jpeg", "stl"]);

function commercialFilter(view: string): CommercialFilter {
  if (view === "invoices") return "invoices";
  if (view === "orders") return "orders";
  return "estimates";
}

function isInvoice(order: StudioOrder) {
  return order.documentType === "Invoice";
}

function isEstimate(order: StudioOrder) {
  return !isInvoice(order);
}

function formatCents(cents: number, currency: "USD" | "BRL") {
  return money(centsToAmount(cents), currency);
}

function clientSnapshot(client: Client) {
  return {
    name: client.name,
    firstName: client.firstName,
    lastName: client.lastName,
    email: client.email,
    phone: client.phone,
    company: client.company,
    address: client.address,
  };
}

function documentClientName(order: StudioOrder) {
  return isInvoice(order)
    ? order.clientSnapshot?.name || order.clientName
    : order.clientName;
}

function statusTone(
  status: StudioOrder["status"]
): "gold" | "success" | "warning" | "neutral" {
  if (status === "Aprovado") return "success";
  if (status === "Em produção") return "gold";
  if (status === "Enviado") return "warning";
  return "neutral";
}

function serviceLabel(serviceType?: ServiceType) {
  return serviceType ? services[serviceType].name : "Serviço a definir";
}

function initialDocument(
  documentType: "Estimativa" | "Invoice",
  taxRate: number
): StudioOrder {
  const timestamp = new Date().toISOString();
  return {
    id: makeId("order"),
    documentType,
    status: "Rascunho",
    clientId: "",
    clientName: "",
    vehicleId: "",
    serviceType: "headlights",
    title: "",
    dueDate: "",
    startDate: today(),
    materialId: "",
    materialName: "",
    materialGrams: 0,
    scope: "",
    constraints: "",
    notes: "",
    publicNote: "",
    privateNote: "",
    lines: [],
    payments: [],
    attachments: [],
    subtotal: 0,
    subtotalCents: 0,
    tax: 0,
    taxCents: 0,
    taxRate,
    total: 0,
    totalCents: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function newCustomServiceLine(serviceType: ServiceType): OrderLine {
  return {
    id: makeId("line"),
    service: "custom",
    kind: "service",
    taxable: false,
    label: services[serviceType].name,
    quantity: 1,
    unitPrice: 0,
    unitPriceCents: 0,
    unit: "horas",
    description: "Preço a definir após avaliação.",
  };
}

function newCustomLine(): OrderLine {
  return {
    id: makeId("line"),
    service: "custom",
    kind: "service",
    taxable: false,
    label: "Serviço personalizado",
    quantity: 1,
    unitPrice: 0,
    unitPriceCents: 0,
    unit: "horas",
    description: "Preço a definir.",
  };
}

function catalogLine(item: CatalogItem): OrderLine {
  return {
    id: makeId("line"),
    service: "custom",
    kind: item.kind,
    taxable: item.kind === "item" ? item.taxable : false,
    label: item.name,
    quantity: 1,
    unitPrice: item.unitPrice,
    unitPriceCents: toCents(item.unitPrice),
    unit: item.kind === "item" ? "unidades" : "horas",
    description: item.description,
    catalogItemId: item.id,
  };
}

function newPayment(): Payment {
  return {
    id: makeId("payment"),
    method: "",
    amount: 0,
    amountCents: 0,
    date: today(),
  };
}

function isAcceptedAttachment(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  return ACCEPTED_EXTENSIONS.has(extension);
}

function formatFileSize(size?: number) {
  if (!size) return "Tamanho não informado";
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function valueAsNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function includesQuery(order: StudioOrder, query: string) {
  if (!query) return true;
  const source = [
    order.id,
    order.title,
    order.clientName,
    order.clientSnapshot?.name,
    order.documentType,
    order.status,
    serviceLabel(order.serviceType),
  ]
    .join(" ")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();
  const normalized = query
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase();
  return source.includes(normalized);
}

/** Commercial estimates, invoices and approved/production orders. */
export default function CommercialPage() {
  const ctx = useGestor();
  const filter = commercialFilter(ctx.view);
  const [editor, setEditor] = useState<StudioOrder | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [removedAttachments, setRemovedAttachments] = useState<Attachment[]>(
    []
  );
  const [catalogItemId, setCatalogItemId] = useState("");
  const [validationError, setValidationError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const { run, busy, error: actionError } = useAction();

  const canEditPrivateNote = ctx.mode !== "demo";

  const visibleOrders = useMemo(() => {
    const inView = ctx.data.orders.filter(order => {
      if (filter === "invoices") return isInvoice(order);
      if (filter === "orders")
        return order.status === "Aprovado" || order.status === "Em produção";
      return isEstimate(order);
    });
    return inView
      .filter(order => includesQuery(order, ctx.search.trim()))
      .sort((a, b) =>
        (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt)
      );
  }, [ctx.data.orders, ctx.search, filter]);

  const effectiveEditorTaxRate = editor?.taxRate ?? ctx.settings.taxRate;

  const editorTotals = useMemo(
    () => calculateOrderTotals(editor?.lines ?? [], effectiveEditorTaxRate),
    [effectiveEditorTaxRate, editor?.lines]
  );

  const currentClient = editor
    ? ctx.data.clients.find(client => client.id === editor.clientId)
    : undefined;
  const availableVehicles = editor
    ? ctx.data.vehicles.filter(vehicle => vehicle.clientId === editor.clientId)
    : [];
  const originalOrder = editor
    ? ctx.data.orders.find(order => order.id === editor.id)
    : undefined;
  const existingInvoice = Boolean(originalOrder && isInvoice(originalOrder));

  const heading =
    filter === "invoices"
      ? {
          title: "Invoices",
          description:
            "Cobranças emitidas, valores recebidos e documentos para o cliente.",
        }
      : filter === "orders"
        ? {
            title: "Pedidos",
            description:
              "Documentos aprovados e em produção, prontos para acompanhar o trabalho.",
          }
        : {
            title: "Estimativas",
            description:
              "Escopo, restrições e estimativas antes da aprovação do cliente.",
          };

  function closeEditor() {
    setEditor(null);
    setPendingFiles([]);
    setRemovedAttachments([]);
    setCatalogItemId("");
    setValidationError("");
    if (fileInput.current) fileInput.current.value = "";
  }

  function openNewDocument() {
    const documentType = filter === "invoices" ? "Invoice" : "Estimativa";
    setEditor({
      ...initialDocument(documentType, ctx.settings.taxRate),
      currency: ctx.settings.currency,
    });
    setPendingFiles([]);
    setRemovedAttachments([]);
    setCatalogItemId("");
    setValidationError("");
  }

  function openEditor(order: StudioOrder) {
    setEditor({
      ...order,
      taxRate: order.taxRate ?? ctx.settings.taxRate,
      lines: order.lines.map(line => ({ ...line })),
      payments: (order.payments ?? []).map(payment => ({ ...payment })),
      attachments: (order.attachments ?? []).map(stripDownloadUrlToken),
    });
    setPendingFiles([]);
    setRemovedAttachments([]);
    setCatalogItemId("");
    setValidationError("");
  }

  function updateEditor(patch: Partial<StudioOrder>) {
    setEditor(current => (current ? { ...current, ...patch } : current));
    setValidationError("");
  }

  function updateLine(lineId: string, patch: Partial<OrderLine>) {
    setEditor(current =>
      current
        ? {
            ...current,
            lines: current.lines.map(line =>
              line.id === lineId
                ? {
                    ...line,
                    ...patch,
                    unitPriceCents: toCents(patch.unitPrice ?? line.unitPrice),
                  }
                : line
            ),
          }
        : current
    );
    setValidationError("");
  }

  function updatePayment(paymentId: string, patch: Partial<Payment>) {
    setEditor(current =>
      current
        ? {
            ...current,
            payments: (current.payments ?? []).map(payment =>
              payment.id === paymentId ? { ...payment, ...patch } : payment
            ),
          }
        : current
    );
    setValidationError("");
  }

  function changeClient(clientId: string) {
    const client = ctx.data.clients.find(entry => entry.id === clientId);
    if (!client || !editor) return;
    const stillLinkedVehicle = ctx.data.vehicles.some(
      vehicle =>
        vehicle.id === editor.vehicleId && vehicle.clientId === client.id
    );
    updateEditor({
      clientId: client.id,
      clientName: client.name,
      vehicleId: stillLinkedVehicle ? editor.vehicleId : "",
    });
  }

  function addCatalogLine() {
    const item = ctx.data.catalogItems.find(
      entry => entry.id === catalogItemId
    );
    if (!item || !editor) return;
    updateEditor({ lines: [...editor.lines, catalogLine(item)] });
    setCatalogItemId("");
  }

  function addCustomService() {
    if (!editor) return;
    updateEditor({
      lines: [
        ...editor.lines,
        newCustomServiceLine(editor.serviceType ?? "headlights"),
      ],
    });
  }

  function addCustomLine() {
    if (!editor) return;
    updateEditor({ lines: [...editor.lines, newCustomLine()] });
  }

  function addPayment() {
    if (!editor) return;
    updateEditor({ payments: [...(editor.payments ?? []), newPayment()] });
  }

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    const rejected = selected.find(
      file => !isAcceptedAttachment(file) || file.size > MAX_ATTACHMENT_SIZE
    );
    if (rejected) {
      ctx.notify(
        !isAcceptedAttachment(rejected)
          ? `“${rejected.name}” não é um tipo de anexo permitido.`
          : `“${rejected.name}” excede o limite de 15 MB.`,
        "error"
      );
      event.currentTarget.value = "";
      return;
    }
    setPendingFiles(current => [...current, ...selected]);
    event.currentTarget.value = "";
  }

  function removePendingFile(file: File) {
    setPendingFiles(current => current.filter(entry => entry !== file));
  }

  async function downloadAttachment(attachment: Attachment) {
    try {
      await ctx.download(attachment);
    } catch (reason) {
      const message =
        reason instanceof Error
          ? reason.message
          : "Não foi possível baixar o anexo.";
      ctx.notify(message, "error");
    }
  }

  function removeAttachment(attachment: Attachment) {
    if (!editor) return;
    setRemovedAttachments(current => [...current, attachment]);
    setEditor(current =>
      current
        ? {
            ...current,
            attachments: (current.attachments ?? []).filter(
              entry => entry.id !== attachment.id
            ),
          }
        : current
    );
  }

  function validateDraft(draft: StudioOrder) {
    if (!draft.clientId || !currentClient)
      return "Selecione o cliente do documento.";
    if (!draft.vehicleId) return "Selecione o veículo associado ao serviço.";
    if (
      !ctx.data.vehicles.some(
        vehicle =>
          vehicle.id === draft.vehicleId && vehicle.clientId === draft.clientId
      )
    ) {
      return "O veículo selecionado não pertence ao cliente informado.";
    }
    if (!draft.title.trim()) return "Informe o título do documento.";
    if (!draft.startDate) return "Informe a data de emissão ou início.";
    if (!draft.scope?.trim())
      return "Informe o escopo aprovado ou em avaliação.";
    const taxRate = draft.taxRate ?? ctx.settings.taxRate;
    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 1) {
      return "A taxa deve estar entre 0% e 100%.";
    }
    if (draft.materialId) {
      if (!Number.isFinite(draft.materialGrams) || draft.materialGrams <= 0) {
        return "Informe uma quantidade positiva para o material reservado.";
      }
    } else if (draft.materialGrams !== 0) {
      return "Selecione um material antes de informar a quantidade reservada.";
    }
    if (!draft.lines.length) return "Adicione ao menos uma linha ao documento.";
    for (const line of draft.lines) {
      if (!line.label.trim())
        return "Todas as linhas precisam de uma descrição.";
      if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
        return `A quantidade da linha “${line.label || "sem descrição"}” deve ser positiva.`;
      }
      if (!Number.isFinite(line.unitPrice) || line.unitPrice < 0) {
        return `O preço da linha “${line.label || "sem descrição"}” não pode ser negativo ou inválido.`;
      }
    }
    const draftTotals = calculateOrderTotals(draft.lines, taxRate);
    const paymentError = validatePayments(
      draftTotals.totalCents,
      draft.payments ?? []
    );
    return paymentError || "";
  }

  function normalizedOrder(draft: StudioOrder) {
    if (!currentClient) throw new Error("Cliente não encontrado.");
    const existing = ctx.data.orders.find(order => order.id === draft.id);
    const lines = draft.lines.map(line => {
      const unitPriceCents = toCents(line.unitPrice);
      const kind = line.kind ?? "service";
      return {
        ...line,
        service: line.service || "custom",
        kind,
        taxable: kind === "item" ? line.taxable !== false : false,
        unit: kind === "item" ? ("unidades" as const) : ("horas" as const),
        label: line.label.trim(),
        description: line.description.trim(),
        quantity: line.quantity,
        unitPrice: centsToAmount(unitPriceCents),
        unitPriceCents,
      };
    });
    const payments = (draft.payments ?? []).map(payment => {
      const amountCents = toCents(payment.amount);
      return {
        ...payment,
        method: payment.method.trim(),
        amount: centsToAmount(amountCents),
        amountCents,
      };
    });
    const taxRate = draft.taxRate ?? ctx.settings.taxRate;
    const totals = calculateOrderTotals(lines, taxRate);
    const shouldKeepInvoiceSnapshot =
      isInvoice(existing ?? draft) &&
      (!existing || existing.clientId === currentClient.id);
    const invoiceSnapshot = shouldKeepInvoiceSnapshot
      ? (existing?.clientSnapshot ??
        draft.clientSnapshot ??
        clientSnapshot(currentClient))
      : isInvoice(draft)
        ? clientSnapshot(currentClient)
        : undefined;

    return {
      ...draft,
      documentType:
        draft.documentType === "Orçamento" ? "Estimativa" : draft.documentType,
      clientId: currentClient.id,
      clientName: invoiceSnapshot?.name || currentClient.name,
      clientSnapshot: invoiceSnapshot,
      materialName: draft.materialId
        ? (ctx.data.materials.find(material => material.id === draft.materialId)
            ?.name ?? draft.materialName)
        : "",
      materialGrams: draft.materialId ? draft.materialGrams : 0,
      scope: draft.scope?.trim() || "",
      constraints: draft.constraints?.trim() || "",
      notes: draft.publicNote?.trim() || draft.notes || "",
      publicNote: draft.publicNote?.trim() || "",
      privateNote: canEditPrivateNote
        ? draft.privateNote?.trim() || ""
        : (existing?.privateNote ?? draft.privateNote),
      lines,
      payments,
      attachments: (draft.attachments ?? []).map(stripDownloadUrlToken),
      subtotalCents: totals.subtotalCents,
      subtotal: centsToAmount(totals.subtotalCents),
      taxCents: totals.taxCents,
      tax: centsToAmount(totals.taxCents),
      taxRate,
      totalCents: totals.totalCents,
      total: centsToAmount(totals.totalCents),
      updatedAt: new Date().toISOString(),
    } satisfies StudioOrder;
  }

  async function saveDocument() {
    if (!editor) return;
    const error = validateDraft(editor);
    if (error) {
      setValidationError(error);
      throw new Error(error);
    }

    let uploaded: Attachment[] = [];
    try {
      const order = normalizedOrder(editor);
      for (const file of pendingFiles) {
        const attachment = await ctx.upload(order.id, file, "document");
        uploaded.push(stripDownloadUrlToken(attachment));
      }
      await ctx.saveOrder({
        ...order,
        attachments: [...order.attachments, ...uploaded],
      });
      const cleanup = await Promise.allSettled(
        removedAttachments.map(attachment => ctx.removeFile(attachment))
      );
      if (cleanup.some(result => result.status === "rejected"))
        ctx.notify(
          "Documento salvo; alguns arquivos removidos não puderam ser apagados do armazenamento. Tente a limpeza novamente.",
          "info"
        );
      closeEditor();
    } catch (reason) {
      const cleanup = await Promise.allSettled(
        uploaded.map(attachment => ctx.removeFile(attachment))
      );
      if (cleanup.some(result => result.status === "rejected"))
        throw new Error(
          "O documento não foi salvo e alguns anexos enviados não puderam ser removidos. Preserve os dados e revise o armazenamento antes de reenviar."
        );
      const message =
        reason instanceof Error
          ? reason.message
          : "Não foi possível salvar o documento.";
      ctx.notify(message, "error");
      throw reason instanceof Error ? reason : new Error(message);
    }
  }

  function convertEstimate(order: StudioOrder) {
    void run(async () => {
      await ctx.convertEstimate(order);
      ctx.navigate("invoices");
    }, "Estimativa convertida em invoice.");
  }

  function deleteDocument(order: StudioOrder) {
    return async () => {
      await ctx.remove("orders", order.id);
    };
  }

  function downloadDocument(order: StudioOrder) {
    void run(async () => {
      // The legacy generator intentionally includes only the public note, never privateNote.
      const { downloadInvoicePdf } = await import("../../lib/pdf");
      await downloadInvoicePdf(order, ctx.settings);
    }, "PDF preparado para download.");
  }

  if (ctx.loading) {
    return (
      <section
        className="stack"
        aria-busy="true"
        aria-label="Carregando documentos comerciais"
      >
        <PageHeading
          eyebrow="Comercial"
          title="Carregando documentos"
          description="Buscando estimativas, invoices e pedidos."
        />
        <div className="card card-body">Carregando dados comerciais…</div>
      </section>
    );
  }

  if (ctx.error) {
    return (
      <section className="stack">
        <PageHeading
          eyebrow="Comercial"
          title="Documentos comerciais"
          description="Não foi possível carregar os dados."
        />
        <div className="card card-body" role="alert">
          <p className="error-message">{ctx.error}</p>
          <Button type="button" variant="secondary" onClick={ctx.retry}>
            Tentar novamente
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="stack" aria-labelledby="commercial-heading">
      <PageHeading
        eyebrow="Comercial"
        title={heading.title}
        description={heading.description}
        action={
          <Button type="button" variant="primary" onClick={openNewDocument}>
            Novo documento
          </Button>
        }
      />

      <div
        className="tabs"
        role="tablist"
        aria-label="Tipo de documento comercial"
      >
        <button
          type="button"
          role="tab"
          aria-selected={filter === "estimates"}
          className={filter === "estimates" ? "active" : ""}
          onClick={() => ctx.navigate("estimates")}
        >
          Estimativas
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={filter === "invoices"}
          className={filter === "invoices" ? "active" : ""}
          onClick={() => ctx.navigate("invoices")}
        >
          Invoices
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={filter === "orders"}
          className={filter === "orders" ? "active" : ""}
          onClick={() => ctx.navigate("orders")}
        >
          Pedidos
        </button>
      </div>

      <div className="toolbar">
        <label className="field" htmlFor="commercial-search">
          <span>Buscar documentos</span>
          <input
            id="commercial-search"
            type="search"
            value={ctx.search}
            onChange={event => ctx.setSearch(event.target.value)}
            placeholder="Título, cliente, serviço ou identificador"
          />
        </label>
        <p className="muted" aria-live="polite">
          {visibleOrders.length}{" "}
          {visibleOrders.length === 1 ? "documento" : "documentos"}
        </p>
      </div>

      {actionError ? (
        <p className="error-message" role="alert">
          {actionError}
        </p>
      ) : null}

      {visibleOrders.length === 0 ? (
        <EmptyState
          title={`Nenhum${filter === "invoices" ? "a" : ""} ${heading.title.toLocaleLowerCase()} encontrado${filter === "invoices" ? "a" : ""}.`}
          description={
            ctx.search
              ? "Ajuste a busca ou limpe o filtro para ver outros documentos."
              : "Crie o primeiro documento para iniciar o acompanhamento comercial."
          }
          action={
            <Button type="button" variant="primary" onClick={openNewDocument}>
              Novo documento
            </Button>
          }
        />
      ) : (
        <div
          className="list"
          aria-label={`Lista de ${heading.title.toLocaleLowerCase()}`}
        >
          {visibleOrders.map(order => {
            const totals = calculateOrderTotals(
              order.lines,
              order.taxRate ?? 0
            );
            return (
              <article className="card list-row" key={order.id}>
                <div className="stack">
                  <div className="row wrap">
                    <strong>{order.title || "Documento sem título"}</strong>
                    <Badge tone={statusTone(order.status)}>
                      {order.status}
                    </Badge>
                    <Badge tone="neutral">{order.documentType}</Badge>
                  </div>
                  <div className="details-grid muted">
                    <span>
                      Cliente: {documentClientName(order) || "Não informado"}
                    </span>
                    <span>Serviço: {serviceLabel(order.serviceType)}</span>
                    <span>Emissão: {order.startDate || "Não informada"}</span>
                    <span>Entrega: {order.dueDate || "A definir"}</span>
                  </div>
                </div>
                <div className="row wrap">
                  <strong
                    aria-label={`Total ${formatCents(totals.totalCents, order.currency ?? "USD")}`}
                  >
                    {formatCents(totals.totalCents, order.currency ?? "USD")}
                  </strong>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => openEditor(order)}
                  >
                    Editar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => downloadDocument(order)}
                  >
                    Baixar PDF
                  </Button>
                  {isEstimate(order) && !order.invoiceId ? (
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => convertEstimate(order)}
                    >
                      Converter em invoice
                    </Button>
                  ) : null}
                  <ConfirmButton
                    label="Excluir"
                    confirmation={`Excluir “${order.title || order.id}”? Esta ação não pode ser desfeita.`}
                    variant="danger"
                    onConfirm={deleteDocument(order)}
                  />
                </div>
              </article>
            );
          })}
        </div>
      )}

      {editor ? (
        <FormModal
          title={
            existingInvoice
              ? "Editar invoice emitida"
              : editor.id && originalOrder
                ? "Editar documento"
                : "Novo documento"
          }
          onClose={closeEditor}
          onSubmit={saveDocument}
          submitLabel={busy ? "Salvando…" : "Salvar documento"}
        >
          <div className="stack">
            {validationError ? (
              <p className="error-message" role="alert">
                {validationError}
              </p>
            ) : null}

            <div className="form-grid">
              <Field
                label="Tipo de documento"
                help={
                  existingInvoice
                    ? "O tipo de uma invoice já emitida é preservado."
                    : undefined
                }
              >
                <select
                  value={editor.documentType}
                  disabled={existingInvoice}
                  onChange={event =>
                    updateEditor({
                      documentType: event.target.value as DocumentType,
                    })
                  }
                >
                  <option value="Estimativa">Estimativa</option>
                  <option value="Invoice">Invoice</option>
                  {editor.documentType === "Orçamento" ? (
                    <option value="Orçamento">Orçamento (legado)</option>
                  ) : null}
                </select>
              </Field>

              <Field label="Status">
                <select
                  value={editor.status}
                  onChange={event =>
                    updateEditor({
                      status: event.target.value as StudioOrder["status"],
                    })
                  }
                >
                  <option value="Rascunho">Rascunho</option>
                  <option value="Enviado">Enviado</option>
                  <option value="Aprovado">Aprovado</option>
                  <option value="Em produção">Em produção</option>
                </select>
              </Field>

              <Field
                label="Cliente"
                error={
                  !ctx.data.clients.length
                    ? "Cadastre um cliente antes de criar o documento."
                    : undefined
                }
              >
                <select
                  required
                  value={editor.clientId}
                  disabled={existingInvoice || !ctx.data.clients.length}
                  onChange={event => changeClient(event.target.value)}
                >
                  <option value="">Selecione o cliente</option>
                  {ctx.data.clients.map(client => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                      {client.company ? ` · ${client.company}` : ""}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label="Veículo"
                error={
                  editor.clientId && !availableVehicles.length
                    ? "Não há veículo cadastrado para este cliente."
                    : undefined
                }
              >
                <select
                  required
                  value={editor.vehicleId || ""}
                  disabled={!editor.clientId || !availableVehicles.length}
                  onChange={event =>
                    updateEditor({ vehicleId: event.target.value })
                  }
                >
                  <option value="">Selecione o veículo</option>
                  {availableVehicles.map(vehicle => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.make} {vehicle.model} · {vehicle.year}
                      {vehicle.plate ? ` · ${vehicle.plate}` : ""}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Serviço automotivo">
                <select
                  value={editor.serviceType ?? "headlights"}
                  onChange={event =>
                    updateEditor({
                      serviceType: event.target.value as ServiceType,
                    })
                  }
                >
                  {(Object.keys(services) as ServiceType[]).map(service => (
                    <option key={service} value={service}>
                      {services[service].name}
                    </option>
                  ))}
                </select>
              </Field>

              <Field
                label="Título"
                error={!editor.title.trim() ? "Obrigatório" : undefined}
              >
                <input
                  required
                  value={editor.title}
                  onChange={event =>
                    updateEditor({ title: event.target.value })
                  }
                  placeholder="Ex.: Recuperação do farol esquerdo"
                />
              </Field>

              <Field label="Data de emissão ou início">
                <DateInput
                  required
                  value={editor.startDate}
                  onChange={event =>
                    updateEditor({ startDate: event.target.value })
                  }
                />
              </Field>

              <Field
                label="Prazo ou entrega"
                help="Pode ser definido após a avaliação."
              >
                <DateInput
                  value={editor.dueDate}
                  min={editor.startDate || undefined}
                  onChange={event =>
                    updateEditor({ dueDate: event.target.value })
                  }
                />
              </Field>

              <Field
                label="Escopo"
                className="field-full"
                error={!editor.scope?.trim() ? "Obrigatório" : undefined}
              >
                <textarea
                  required
                  value={editor.scope ?? ""}
                  onChange={event =>
                    updateEditor({ scope: event.target.value })
                  }
                  placeholder="Intervenção, componentes e acabamento incluídos."
                />
              </Field>

              <Field
                label="Restrições e premissas"
                className="field-full"
                help={services[editor.serviceType ?? "headlights"].limit}
              >
                <textarea
                  value={editor.constraints ?? ""}
                  onChange={event =>
                    updateEditor({ constraints: event.target.value })
                  }
                  placeholder="Condições observadas, exclusões e aprovações necessárias."
                />
              </Field>
            </div>

            <section className="card" aria-labelledby="document-lines-heading">
              <div className="card-head split">
                <div>
                  <h3 id="document-lines-heading">Itens e serviços</h3>
                  <p className="muted">
                    Serviços novos iniciam em zero e devem ser precificados
                    explicitamente antes do envio.
                  </p>
                </div>
                <div className="row wrap">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={addCustomService}
                  >
                    Adicionar {serviceLabel(editor.serviceType)}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={addCustomLine}
                  >
                    Linha personalizada
                  </Button>
                </div>
              </div>
              <div className="card-body stack">
                <div className="row wrap">
                  <label className="field" htmlFor="catalog-item">
                    <span>Catálogo</span>
                    <select
                      id="catalog-item"
                      value={catalogItemId}
                      onChange={event => setCatalogItemId(event.target.value)}
                    >
                      <option value="">Selecione um item ou serviço</option>
                      {ctx.data.catalogItems
                        .filter(
                          item =>
                            (item.currency ?? "USD") ===
                            (editor?.currency ?? ctx.settings.currency)
                        )
                        .map(item => (
                          <option key={item.id} value={item.id}>
                            {item.name} ·{" "}
                            {formatCents(
                              toCents(item.unitPrice),
                              editor?.currency ?? ctx.settings.currency
                            )}
                          </option>
                        ))}
                    </select>
                  </label>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!catalogItemId}
                    onClick={addCatalogLine}
                  >
                    Adicionar do catálogo
                  </Button>
                </div>

                {editor.lines.length === 0 ? (
                  <p className="helper">
                    Adicione um serviço automotivo, um item do catálogo ou uma
                    linha personalizada.
                  </p>
                ) : (
                  <div className="document-lines">
                    {editor.lines.map((line, index) => (
                      <fieldset className="line-row" key={line.id}>
                        <legend>Linha {index + 1}</legend>
                        <div className="form-grid">
                          <Field label="Descrição">
                            <input
                              required
                              value={line.label}
                              onChange={event =>
                                updateLine(line.id, {
                                  label: event.target.value,
                                })
                              }
                            />
                          </Field>
                          <Field label="Tipo">
                            <select
                              value={line.kind ?? "service"}
                              onChange={event => {
                                const kind = event.target.value as
                                  | "item"
                                  | "service";
                                updateLine(line.id, {
                                  kind,
                                  taxable:
                                    kind === "item"
                                      ? line.taxable !== false
                                      : false,
                                  unit: kind === "item" ? "unidades" : "horas",
                                });
                              }}
                            >
                              <option value="service">Serviço</option>
                              <option value="item">Item</option>
                            </select>
                          </Field>
                          <Field label="Quantidade">
                            <input
                              required
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={
                                Number.isFinite(line.quantity)
                                  ? line.quantity
                                  : ""
                              }
                              onChange={event =>
                                updateLine(line.id, {
                                  quantity: valueAsNumber(event.target.value),
                                })
                              }
                            />
                          </Field>
                          <Field
                            label={`Preço unitário (${editor?.currency ?? ctx.settings.currency})`}
                          >
                            <input
                              required
                              type="number"
                              min="0"
                              step="0.01"
                              value={
                                Number.isFinite(line.unitPrice)
                                  ? line.unitPrice
                                  : ""
                              }
                              onChange={event =>
                                updateLine(line.id, {
                                  unitPrice: valueAsNumber(event.target.value),
                                })
                              }
                            />
                          </Field>
                          {line.kind === "item" ? (
                            <label className="field">
                              <span>Tributável</span>
                              <input
                                type="checkbox"
                                checked={line.taxable !== false}
                                onChange={event =>
                                  updateLine(line.id, {
                                    taxable: event.target.checked,
                                  })
                                }
                              />
                            </label>
                          ) : null}
                          <Field label="Detalhamento" className="field-full">
                            <textarea
                              value={line.description}
                              onChange={event =>
                                updateLine(line.id, {
                                  description: event.target.value,
                                })
                              }
                              placeholder="Componentes, condição ou entrega desta linha"
                            />
                          </Field>
                        </div>
                        <div className="row wrap">
                          <span className="muted">
                            Total da linha:{" "}
                            {formatCents(
                              calculateOrderTotals([line], 0).subtotalCents,
                              editor?.currency ?? ctx.settings.currency
                            )}
                          </span>
                          <Button
                            type="button"
                            variant="danger"
                            onClick={() =>
                              updateEditor({
                                lines: editor.lines.filter(
                                  entry => entry.id !== line.id
                                ),
                              })
                            }
                          >
                            Remover linha
                          </Button>
                        </div>
                      </fieldset>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="card" aria-labelledby="payment-heading">
              <div className="card-head split">
                <div>
                  <h3 id="payment-heading">Taxa e pagamentos</h3>
                  <p className="muted">
                    Pagamentos de valor zero são permitidos quando registrados
                    de forma explícita.
                  </p>
                </div>
                <Button type="button" variant="secondary" onClick={addPayment}>
                  Adicionar pagamento
                </Button>
              </div>
              <div className="card-body stack">
                <div className="form-grid">
                  <Field
                    label="Taxa sobre itens (%)"
                    help="A taxa incide somente sobre linhas classificadas como item tributável."
                  >
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={
                        Number.isFinite(effectiveEditorTaxRate)
                          ? Number((effectiveEditorTaxRate * 100).toFixed(4))
                          : ""
                      }
                      onChange={event =>
                        updateEditor({
                          taxRate: valueAsNumber(event.target.value) / 100,
                        })
                      }
                    />
                  </Field>

                  <Field
                    label="Material reservado"
                    help="A reserva é validada atomicamente ao salvar."
                  >
                    <select
                      value={editor.materialId}
                      onChange={event => {
                        const material = ctx.data.materials.find(
                          entry => entry.id === event.target.value
                        );
                        updateEditor({
                          materialId: material?.id || "",
                          materialName: material?.name || "",
                          materialGrams: material
                            ? editor.materialGrams || 0
                            : 0,
                        });
                      }}
                    >
                      <option value="">Sem material reservado</option>
                      {ctx.data.materials.map(material => (
                        <option key={material.id} value={material.id}>
                          {material.name} · disponível:{" "}
                          {material.availableGrams} g
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Quantidade reservada (g)">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      disabled={!editor.materialId}
                      value={editor.materialId ? editor.materialGrams : 0}
                      onChange={event =>
                        updateEditor({
                          materialGrams: valueAsNumber(event.target.value),
                        })
                      }
                    />
                  </Field>
                </div>

                {(editor.payments ?? []).length === 0 ? (
                  <p className="helper">Nenhum pagamento registrado.</p>
                ) : (
                  <div className="document-lines">
                    {(editor.payments ?? []).map((payment, index) => (
                      <fieldset className="line-row" key={payment.id}>
                        <legend>Pagamento {index + 1}</legend>
                        <div className="form-grid">
                          <Field label="Método">
                            <input
                              required
                              value={payment.method}
                              onChange={event =>
                                updatePayment(payment.id, {
                                  method: event.target.value,
                                })
                              }
                              placeholder="Pix, cartão, transferência…"
                            />
                          </Field>
                          <Field
                            label={`Valor (${editor?.currency ?? ctx.settings.currency})`}
                            help={
                              payment.amount === 0
                                ? "Valor zero registrado explicitamente."
                                : undefined
                            }
                          >
                            <input
                              required
                              type="number"
                              min="0"
                              step="0.01"
                              value={
                                Number.isFinite(payment.amount)
                                  ? payment.amount
                                  : ""
                              }
                              onChange={event =>
                                updatePayment(payment.id, {
                                  amount: valueAsNumber(event.target.value),
                                })
                              }
                            />
                          </Field>
                          <Field label="Data">
                            <DateInput
                              required
                              value={payment.date}
                              onChange={event =>
                                updatePayment(payment.id, {
                                  date: event.target.value,
                                })
                              }
                            />
                          </Field>
                        </div>
                        <Button
                          type="button"
                          variant="danger"
                          onClick={() =>
                            updateEditor({
                              payments: (editor.payments ?? []).filter(
                                entry => entry.id !== payment.id
                              ),
                            })
                          }
                        >
                          Remover pagamento
                        </Button>
                      </fieldset>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="card" aria-labelledby="notes-heading">
              <div className="card-head">
                <h3 id="notes-heading">Notas e anexos</h3>
              </div>
              <div className="card-body stack">
                <Field
                  label="Nota pública"
                  help="Incluída no PDF do documento."
                >
                  <textarea
                    value={editor.publicNote ?? ""}
                    onChange={event =>
                      updateEditor({
                        publicNote: event.target.value,
                        notes: event.target.value,
                      })
                    }
                    placeholder="Informações que podem ser compartilhadas com o cliente."
                  />
                </Field>

                {canEditPrivateNote ? (
                  <Field
                    label="Nota privada"
                    help="Somente a sessão autenticada pode editar esta nota; ela não é incluída no PDF."
                  >
                    <textarea
                      value={editor.privateNote ?? ""}
                      onChange={event =>
                        updateEditor({ privateNote: event.target.value })
                      }
                      placeholder="Registro interno do atendimento."
                    />
                  </Field>
                ) : (
                  <p className="helper">
                    Notas privadas exigem uma sessão autenticada e não são
                    exibidas nesta tela.
                  </p>
                )}

                <Field
                  label="Anexos seguros"
                  help="PDF, PNG, JPG/JPEG ou STL de até 15 MB. São salvos como metadados; links com token não são persistidos."
                >
                  <input
                    ref={fileInput}
                    type="file"
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg,.stl"
                    onChange={handleFiles}
                  />
                </Field>

                {(editor.attachments ?? []).length || pendingFiles.length ? (
                  <ul className="list" aria-label="Anexos do documento">
                    {(editor.attachments ?? []).map(attachment => (
                      <li
                        className="list-row"
                        key={
                          attachment.id ||
                          attachment.storagePath ||
                          attachment.name
                        }
                      >
                        <span>
                          {attachment.name}{" "}
                          <span className="muted">
                            · {formatFileSize(attachment.size)}
                          </span>
                        </span>
                        <span className="row wrap">
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => {
                              void downloadAttachment(attachment);
                            }}
                          >
                            Baixar
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            onClick={() => removeAttachment(attachment)}
                          >
                            Remover
                          </Button>
                        </span>
                      </li>
                    ))}
                    {pendingFiles.map(file => (
                      <li
                        className="list-row"
                        key={`${file.name}-${file.lastModified}-${file.size}`}
                      >
                        <span>
                          {file.name}{" "}
                          <span className="muted">
                            · {formatFileSize(file.size)} · aguardando envio
                          </span>
                        </span>
                        <Button
                          type="button"
                          variant="danger"
                          onClick={() => removePendingFile(file)}
                        >
                          Remover
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="helper">Nenhum anexo adicionado.</p>
                )}
              </div>
            </section>

            <section className="metric-grid" aria-label="Totais calculados">
              <div className="stat">
                <span className="stat-label">Subtotal</span>
                <strong className="stat-value">
                  {formatCents(
                    editorTotals.subtotalCents,
                    editor?.currency ?? ctx.settings.currency
                  )}
                </strong>
              </div>
              <div className="stat">
                <span className="stat-label">Taxa</span>
                <strong className="stat-value">
                  {formatCents(
                    editorTotals.taxCents,
                    editor?.currency ?? ctx.settings.currency
                  )}
                </strong>
              </div>
              <div className="stat">
                <span className="stat-label">Total</span>
                <strong className="stat-value">
                  {formatCents(
                    editorTotals.totalCents,
                    editor?.currency ?? ctx.settings.currency
                  )}
                </strong>
              </div>
              <div className="stat">
                <span className="stat-label">Pagamentos registrados</span>
                <strong className="stat-value">
                  {formatCents(
                    (editor.payments ?? []).reduce(
                      (sum, payment) => sum + toCents(payment.amount),
                      0
                    ),
                    editor?.currency ?? ctx.settings.currency
                  )}
                </strong>
              </div>
            </section>
          </div>
        </FormModal>
      ) : null}
    </section>
  );
}
