import { useMemo, useState } from "react";
import {
  Box,
  CircleDollarSign,
  FileDown,
  FileText,
  HardHat,
  Paperclip,
  Pencil,
  Plus,
  UsersRound,
  X,
} from "lucide-react";
import { calculateLineSubtotalCents, calculateOrderTotals, centsToAmount, printServicePrice, toCents } from "@/lib/finance";
import type { Attachment, CatalogItem, Client, Material, Order, OrderLine, Payment } from "@/lib/models";
import { isEstimate } from "@/lib/documents";
import { currency } from "@/lib/formatters";

const serviceLabels: Record<OrderLine["service"], string> = {
  scan: "Escaneamento 3D",
  cad: "CAD / modelagem",
  print: "Impressão",
  post: "Pós-processamento",
  hardware: "Hardware / componentes",
  shipping: "Envio",
  custom: "Personalizado",
};

const paymentMethods = ["Pix", "Dinheiro", "Cartão", "ACH", "Transferência", "Cheque", "Outro"];

function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal-panel modal-wide" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-heading"><div><p className="eyebrow">Reverso Works</p><h2>{title}</h2></div><button className="icon-button" type="button" aria-label="Fechar" onClick={onClose}><X size={19} /></button></div>
        {children}
      </section>
    </div>
  );
}

export function NewDocumentDialog({ onClose, onSelect }: { onClose: () => void; onSelect: (type: "Estimativa" | "Invoice") => void }) {
  return (
    <Modal title="Novo documento" onClose={onClose}>
      <div className="dialog-form" style={{ gridTemplateColumns: "1fr" }}>
        <button type="button" className="button button-primary full-width" onClick={() => onSelect("Estimativa")}><FileText size={18} /> Estimativa</button>
        <button type="button" className="button button-secondary full-width" onClick={() => onSelect("Invoice")}><CircleDollarSign size={18} /> Invoice</button>
      </div>
    </Modal>
  );
}

type DocumentDialogProps = {
  order: Order;
  existing: boolean;
  authenticated: boolean;
  clients: Client[];
  materials: Material[];
  catalogItems: CatalogItem[];
  onChange: (order: Order) => void;
  onClose: () => void;
  onSave: (order: Order) => Promise<boolean>;
  onConvert: (order: Order) => Promise<boolean>;
  onPrint: (order: Order) => void;
  onAttach: (order: Order, file: File) => Promise<Attachment>;
  createLine: (service: OrderLine["service"], material: Material) => OrderLine;
};

export default function DocumentDialog({ order, existing, authenticated, clients, materials, catalogItems, onChange, onClose, onSave, onConvert, onPrint, onAttach, createLine }: DocumentDialogProps) {
  const [readOnly, setReadOnly] = useState(existing);
  const [dirty, setDirty] = useState(false);
  const [clientQuery, setClientQuery] = useState(order.clientName || "");
  const [attachBusy, setAttachBusy] = useState(false);
  const [attachError, setAttachError] = useState("");
  const material = materials.find((item) => item.id === order.materialId) ?? materials[0];
  const totals = calculateOrderTotals(order.lines, order.taxRate ?? 0);
  const suggestions = useMemo(() => {
    const query = clientQuery.trim().toLocaleLowerCase();
    if (query.length < 4) return [];
    return clients.filter((client) => `${client.name} ${client.email} ${client.company}`.toLocaleLowerCase().includes(query)).slice(0, 8);
  }, [clientQuery, clients]);

  function change(next: Order) {
    setDirty(true);
    onChange(next);
  }

  function requestClose() {
    if (!readOnly && dirty && !window.confirm("Descartar alterações não salvas?")) return;
    onClose();
  }

  function selectClient(client: Client) {
    setClientQuery(client.name);
    change({
      ...order,
      clientId: client.id,
      clientName: client.name,
      clientSnapshot: {
        name: client.name,
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email,
        phone: client.phone,
        company: client.company,
        address: client.address,
      },
    });
  }

  function updateLine(lineId: string, patch: Partial<OrderLine>) {
    change({ ...order, lines: order.lines.map((line) => line.id === lineId ? { ...line, ...patch } : line) });
  }

  function updatePrintLine(line: OrderLine, patch: Partial<OrderLine>) {
    const next = { ...line, ...patch };
    const selectedMaterial = materials.find((item) => item.id === next.materialId) ?? material;
    const unitPriceCents = printServicePrice({
      pricePerGram: selectedMaterial.pricePerGram,
      weightGrams: next.weightGrams ?? order.materialGrams ?? 0,
      hours: next.printHours ?? 0,
      hourlyRate: next.hourlyRate ?? 2.5,
    });
    updateLine(line.id, {
      ...next,
      materialId: selectedMaterial.id,
      pricePerGram: selectedMaterial.pricePerGram,
      quantity: 1,
      unit: "horas",
      unitPriceCents,
      unitPrice: centsToAmount(unitPriceCents),
    });
  }

  async function attachFile(file?: File) {
    if (!file) return;
    setAttachBusy(true);
    setAttachError("");
    try {
      const attachment = await onAttach(order, file);
      change({ ...order, attachments: [...(order.attachments ?? []), attachment] });
    } catch (error) {
      setAttachError(error instanceof Error ? error.message : "Não foi possível anexar o arquivo .STL.");
    } finally {
      setAttachBusy(false);
    }
  }

  async function save() {
    if (await onSave(order)) setDirty(false);
  }

  async function convert() {
    if (await onConvert(order)) setDirty(false);
  }

  return (
    <Modal title={`${existing ? "Detalhes" : "Novo"} · ${isEstimate(order) ? "Estimativa" : "Invoice"}`} onClose={requestClose}>
      <div className="order-dialog">
        <fieldset disabled={readOnly} style={{ border: 0, margin: 0, minWidth: 0, padding: 0 }}>
          <div className="document-grid">
            <section className="document-section">
              <div className="section-caption"><UsersRound size={17} /><span>Cliente</span></div>
              <div className="dialog-form">
                <label className="field-stack field-span"><span>Cliente *</span><input list={suggestions.length ? `client-suggestions-${order.id}` : undefined} value={clientQuery} placeholder="Digite 4 caracteres para sugerir" onChange={(event) => {
                  const value = event.target.value;
                  setClientQuery(value);
                  const selected = clients.find((client) => client.name.toLocaleLowerCase() === value.trim().toLocaleLowerCase() || client.email.toLocaleLowerCase() === value.trim().toLocaleLowerCase());
                  if (selected) selectClient(selected);
                  else change({ ...order, clientId: "", clientName: value, clientSnapshot: undefined });
                }} /><datalist id={`client-suggestions-${order.id}`}>{suggestions.map((client) => <option key={client.id} value={client.name}>{client.email}</option>)}</datalist><small>{clientQuery.trim().length < 4 ? "As sugestões aparecem após quatro caracteres." : `${suggestions.length} cliente(s) compatível(is).`}</small></label>
                <label className="field-stack"><span>Início</span><input type="date" value={order.startDate} onChange={(event) => change({ ...order, startDate: event.target.value })} /></label>
                <label className="field-stack"><span>Entrega</span><input type="date" value={order.dueDate} onChange={(event) => change({ ...order, dueDate: event.target.value })} /></label>
                {order.clientSnapshot && <p className="muted-copy field-span">{order.clientSnapshot.email || "Sem e-mail"} · {order.clientSnapshot.phone || "Sem telefone"}</p>}
              </div>
            </section>

            <section className="document-section items-services-section">
              <div className="section-caption"><Box size={17} /><span>Itens e serviços</span><small>Selecione no catálogo, descreva e informe a quantidade.</small></div>
              <div className="dialog-form"><label className="field-stack field-span"><span>Título</span><input value={order.title} onChange={(event) => change({ ...order, title: event.target.value })} placeholder="Nome do trabalho" /></label></div>
              <div className="catalog-add-row"><select aria-label="Item do catálogo" defaultValue="" onChange={(event) => { const item = catalogItems.find((entry) => entry.id === event.target.value); if (!item) return; change({ ...order, lines: [...order.lines, { id: makeId("line"), service: item.kind === "item" ? "hardware" : "custom", kind: item.kind, catalogItemId: item.id, taxable: item.taxable, unit: "unidades", label: item.name, quantity: 1, unitPrice: item.unitPrice, unitPriceCents: toCents(item.unitPrice), description: item.description }] }); event.currentTarget.value = ""; }}><option value="">Adicionar item ou serviço…</option>{catalogItems.map((item) => <option key={item.id} value={item.id}>{item.name} · {currency(item.unitPrice)}</option>)}</select><button type="button" className="button button-secondary" onClick={() => { const item = catalogItems[0]; if (!item) return; change({ ...order, lines: [...order.lines, { id: makeId("line"), service: item.kind === "item" ? "hardware" : "custom", kind: item.kind, catalogItemId: item.id, taxable: item.taxable, unit: "unidades", label: item.name, quantity: 1, unitPrice: item.unitPrice, unitPriceCents: toCents(item.unitPrice), description: item.description }] }); }}><Plus size={14} /> Adicionar</button></div>
              <div className="line-items-header"><span>Item</span><span>Descrição</span><span>Qtd.</span><span>Preço/un.</span><span>Total</span><span /></div>
              <div className="line-items">
                {order.lines.map((line) => <div className="line-item catalog-line-item" key={line.id}>
                  <select aria-label="Item" value={line.catalogItemId ?? ""} onChange={(event) => { const item = catalogItems.find((entry) => entry.id === event.target.value); if (item) updateLine(line.id, { catalogItemId: item.id, service: item.kind === "item" ? "hardware" : "custom", kind: item.kind, label: item.name, unitPrice: item.unitPrice, unitPriceCents: toCents(item.unitPrice), taxable: item.taxable, description: line.description || item.description }); }}><option value="">Selecionar item</option>{catalogItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
                  <input aria-label={`${line.label} descrição`} value={line.description} onChange={(event) => updateLine(line.id, { description: event.target.value })} placeholder="Descrição" />
                  <input aria-label="Quantidade" type="number" min="0" step="1" value={line.quantity} onChange={(event) => updateLine(line.id, { quantity: Number(event.target.value) })} />
                  <input aria-label="Preço por unidade" type="number" min="0" step="0.01" value={centsToAmount(line.unitPriceCents ?? toCents(line.unitPrice))} readOnly />
                  <b>{currency(centsToAmount(calculateLineSubtotalCents(line)))}</b>
                  <button type="button" aria-label={`Remover ${line.label}`} className="icon-button" onClick={() => change({ ...order, lines: order.lines.filter((item) => item.id !== line.id) })}><X size={16} /></button>
                </div>)}
                {!order.lines.length && <p className="muted-copy">Adicione um item ou serviço do catálogo para compor o documento.</p>}
              </div>
              <div className="document-totals"><div className="document-total"><span>Subtotal</span><strong>{currency(centsToAmount(totals.subtotalCents))}</strong></div><div className="document-total"><span>Tax</span><strong>{currency(centsToAmount(totals.taxCents))}</strong></div><div className="document-total document-total-final"><span>Total + Taxes</span><strong>{currency(centsToAmount(totals.totalCents))}</strong></div></div>
            </section>

            <section className="document-section payment-section">
              <div className="section-caption"><CircleDollarSign size={17} /><span>Pagamentos</span></div>
              <div className="payment-strip"><small>Valores persistidos em centavos.</small><button type="button" className="button button-secondary" onClick={() => change({ ...order, payments: [...(order.payments ?? []), { id: makeId("payment"), method: "Pix", amount: 0, amountCents: 0, date: new Date().toISOString().slice(0, 10) } as Payment] })}><Plus size={14} /> Adicionar</button></div>
              <div className="payment-row-header"><span>Método</span><span>Valor</span><span>Data</span><span /></div>
              {(order.payments ?? []).map((payment) => <div className="payment-row" key={payment.id}><select aria-label="Método de pagamento" value={payment.method} onChange={(event) => change({ ...order, payments: order.payments?.map((item) => item.id === payment.id ? { ...item, method: event.target.value } : item) })}>{paymentMethods.map((method) => <option key={method}>{method}</option>)}</select><input aria-label="Valor do pagamento" type="number" min="0" step="0.01" value={centsToAmount(payment.amountCents ?? toCents(payment.amount)) || ""} onChange={(event) => change({ ...order, payments: order.payments?.map((item) => item.id === payment.id ? { ...item, amount: Number(event.target.value), amountCents: toCents(event.target.value) } : item) })} /><input aria-label="Data do pagamento" type="date" value={payment.date} onChange={(event) => change({ ...order, payments: order.payments?.map((item) => item.id === payment.id ? { ...item, date: event.target.value } : item) })} /><button type="button" className="icon-button" aria-label="Remover pagamento" onClick={() => change({ ...order, payments: order.payments?.filter((item) => item.id !== payment.id) })}><X size={15} /></button></div>)}
            </section>

            <section className="document-section">
              <div className="section-caption"><FileText size={17} /><span>Notas e arquivos</span></div>
              <div className="document-notes-grid"><label className="field-stack"><span>Nota pública · aparece no PDF</span><textarea value={order.publicNote ?? ""} onChange={(event) => change({ ...order, publicNote: event.target.value })} /></label>{authenticated && <label className="field-stack"><span>Nota privada · apenas autenticados</span><textarea value={order.privateNote ?? ""} onChange={(event) => change({ ...order, privateNote: event.target.value })} /></label>}</div>
              <label className="button button-secondary"><Paperclip size={16} /> {attachBusy ? "Enviando…" : "Anexar .STL"}<input hidden type="file" accept=".stl,model/stl" disabled={attachBusy} onChange={(event) => void attachFile(event.target.files?.[0])} /></label>
              {attachError && <small className="inline-warning">{attachError}</small>}
              <div className="stack-list">{(order.attachments ?? []).map((attachment) => <div key={attachment.id ?? attachment.storagePath ?? attachment.name}><a href={attachment.downloadUrl} target="_blank" rel="noreferrer">{attachment.name}</a><small>{attachment.size ? `${Math.ceil(attachment.size / 1024)} KB` : ".STL"}</small></div>)}</div>
            </section>
          </div>
        </fieldset>

        <div className="dialog-actions">
          <button type="button" className="button button-secondary" onClick={requestClose}>{readOnly ? "Fechar" : "Cancelar"}</button>
          {readOnly && !isEstimate(order) && <button type="button" className="button button-secondary" onClick={() => onPrint(order)}><FileDown size={16} /> Imprimir</button>}
          {readOnly && <button type="button" className="button button-primary" onClick={() => setReadOnly(false)}><Pencil size={16} /> Modificar</button>}
          {!readOnly && isEstimate(order) && <button type="button" className="button button-secondary" onClick={() => void convert()} disabled={attachBusy}><CircleDollarSign size={16} /> Criar Invoice</button>}
          {!readOnly && !isEstimate(order) && <button type="button" className="button button-secondary" onClick={() => onPrint(order)}><FileDown size={16} /> Imprimir</button>}
          {!readOnly && <button type="button" className="button button-primary" onClick={() => void save()} disabled={attachBusy}>Salvar</button>}
        </div>
      </div>
    </Modal>
  );
}
