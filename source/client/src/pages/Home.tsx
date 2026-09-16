import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "firebase/auth";
import {
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Box,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  Cog,
  FilePlus2,
  FileText,
  HardHat,
  Layers3,
  LogOut,
  Menu,
  PackageOpen,
  Paperclip,
  Pencil,
  Plus,
  Printer,
  ScanLine,
  Settings2,
  Search,
  FileDown,
  Eye,
  Sparkles,
  UsersRound,
  Wrench,
  X,
} from "lucide-react";
import { signOut } from "firebase/auth";
import {
  addWorkspaceEmail,
  auth,
  db,
  uploadStlAttachment,
  workspaceCollection,
} from "@/lib/firebase";
import { currency, dayLabel, displayName, formatUsPhone, greetingForEmail, splitClientName } from "@/lib/formatters";
import { calculateOrderTotals, centsToAmount, printServicePrice, toCents, validatePayments } from "@/lib/finance";
import { createInvoiceFromEstimate, isEstimate, nextFutureOrder, normalizeExpense, normalizeOrderMoney, unifiedSearch } from "@/lib/documents";
import { downloadInvoicePdf } from "@/lib/pdf";
import DocumentDialog, { NewDocumentDialog } from "@/components/DocumentDialog";
import MaterialSelector from "@/components/MaterialSelector";
import type {
  CalendarEvent,
  CatalogItem,
  Client,
  Expense,
  MaintenanceEntry,
  Material,
  Order,
  OrderLine,
  Part,
  PartRevision,
  Payment,
  Printer as PrinterModel,
  ProductionStage,
  Triage,
  ViewId,
} from "@/lib/models";

const defaultMaterials: Material[] = [
  {
    id: "pla-petg",
    name: "PLA / PETG",
    color: "Grafite",
    type: "PLA/PETG",
    availableGrams: 1000,
    reorderAtGrams: 250,
    pricePerGram: 0.025,
    nozzleTemp: "205–225 °C",
    bedTemp: "55–70 °C",
    printNotes: "Versátil, estável e indicado para peças de uso geral.",
  },
  {
    id: "asa-abs",
    name: "ASA / ABS",
    color: "Preto",
    type: "ASA/ABS",
    availableGrams: 750,
    reorderAtGrams: 200,
    pricePerGram: 0.03,
    nozzleTemp: "245–265 °C",
    bedTemp: "95–110 °C",
    printNotes: "Indicado para exterior; usar câmara fechada e ventilação controlada.",
  },
  {
    id: "nylon",
    name: "Nylon / Compósito",
    color: "Natural",
    type: "Nylon",
    availableGrams: 500,
    reorderAtGrams: 150,
    pricePerGram: 0.055,
    nozzleTemp: "255–290 °C",
    bedTemp: "70–100 °C",
    printNotes: "Secar antes do uso. Alta resistência mecânica e absorção de umidade.",
  },
];

const defaultPrinters: PrinterModel[] = [
  {
    id: "x2d",
    name: "Bambu Lab X2D",
    model: "X2D · AMS",
    status: "Pronta",
    material: "PLA / PETG",
    lastMaintenance: "2026-08-27",
    maintenance: [],
    maxNozzleTemp: 300,
    maxBedTemp: 120,
    maxChamberTemp: 50,
    buildVolume: "256 × 256 × 256",
    nozzleDiameter: 0.4,
    hardenedNozzle: false,
    dryingAvailable: true,
    compatibleMaterials: ["PLA", "PETG", "ASA", "ABS", "Nylon"],
  },
];

const serviceLabels: Record<OrderLine["service"], string> = {
  scan: "Escaneamento 3D",
  cad: "CAD / modelagem",
  print: "Impressão 3D",
  post: "Pós-processamento",
  hardware: "Hardware / componentes",
  shipping: "Envio",
  custom: "Personalizado",
};
const productionStages: Array<{ id: ProductionStage; label: string; detail: string }> = [
  { id: "planning", label: "Triagem", detail: "Entrada e definição" },
  { id: "approval", label: "Aprovação", detail: "Cliente e escopo" },
  { id: "production", label: "Produção", detail: "Execução em fábrica" },
  { id: "quality", label: "Qualidade", detail: "Inspeção e validação" },
  { id: "shipping", label: "Envio", detail: "Despacho e conclusão" },
];

const defaultCatalogItems: CatalogItem[] = [
  { id: "cat-item", name: "Item personalizado", description: "Componentes ou produto definido no documento.", unitPrice: 0, taxable: true, kind: "item" },
  { id: "cat-scan", name: "Escaneamento 3D", description: "Serviço de captura e preparação da referência física.", unitPrice: 85, taxable: false, kind: "service" },
  { id: "cat-cad", name: "CAD / modelagem", description: "Modelagem técnica e preparação do arquivo.", unitPrice: 75, taxable: false, kind: "service" },
  { id: "cat-print", name: "Impressão 3D", description: "Produção aditiva conforme material e parâmetros definidos.", unitPrice: 0, taxable: false, kind: "service" },
  { id: "cat-post", name: "Pós-processamento", description: "Acabamento, preparação e inspeção final.", unitPrice: 45, taxable: false, kind: "service" },
  { id: "cat-shipping", name: "Envio", description: "Embalagem e transporte definidos no documento.", unitPrice: 0, taxable: true, kind: "service" },
];

const technicalParts = [
  {
    title: "Carcaça flangeada",
    category: "Referência física",
    description: "Geometria, furação e acabamento para a primeira leitura.",
    image: `${import.meta.env.BASE_URL}technical-parts/flange-housing.jpg`,
  },
  {
    title: "Conjunto estriado",
    category: "Conjunto mecânico",
    description: "Acoplamento, fixação e interface entre componentes.",
    image: `${import.meta.env.BASE_URL}technical-parts/coupling-shaft.jpg`,
  },
  {
    title: "Medição dimensional",
    category: "Inspeção",
    description: "Medidas críticas antes de definir material e processo.",
    image: `${import.meta.env.BASE_URL}technical-parts/vernier-inspection.jpg`,
  },
];

function id(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function nowIso() {
  return new Date().toISOString();
}

function todayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={`modal-panel ${wide ? "modal-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <div>
            <p className="eyebrow">Reverso Works</p>
            <h2>{title}</h2>
          </div>
          <button className="icon-button" type="button" aria-label="Fechar" onClick={onClose}>
            <X size={19} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="section-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="section-description">{description}</p>
      </div>
      {action}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: typeof Box;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><Icon size={23} /></div>
      <div>
        <strong>{title}</strong>
        <p>{body}</p>
      </div>
      {action}
    </div>
  );
}

function clientTemplate(): Client {
  return {
    id: id("client"),
    name: "",
    email: "",
    phone: "",
    company: "",
    address: "",
    notes: "",
  };
}

function materialTemplate(): Material {
  return {
    id: id("material"),
    name: "",
    color: "",
    type: "",
    availableGrams: 0,
    reorderAtGrams: 250,
    pricePerGram: 0.03,
    nozzleTemp: "",
    bedTemp: "",
    printNotes: "",
  };
}

function calendarTemplate(): CalendarEvent {
  return {
    id: id("event"),
    title: "",
    detail: "",
    date: new Date().toISOString().slice(0, 16),
    type: "calendar",
  };
}

function printerTemplate(): PrinterModel {
  return { id: id("printer"), name: "", model: "", status: "Pronta", material: "", lastMaintenance: "", maintenance: [], maxNozzleTemp: 300, maxBedTemp: 120, maxChamberTemp: 50, buildVolume: "", nozzleDiameter: 0.4, hardenedNozzle: false, dryingAvailable: false, compatibleMaterials: [] };
}

function orderTemplate(material: Material, documentType: "Estimativa" | "Invoice" = "Estimativa"): Order {
  return {
    id: id("order"),
    documentType,
    status: "Rascunho",
    clientId: "",
    clientName: "",
    title: "",
    dueDate: "",
    startDate: todayInputValue(),
    materialId: material.id,
    materialName: material.name,
    productionStage: "planning",
    materialGrams: 0,
    notes: "",
    publicNote: "",
    privateNote: "",
    payments: [],
    attachments: [],
    lines: [],
    total: 0,
    totalCents: 0,
    createdAt: nowIso(),
  };
}

function expenseTemplate(): Expense {
  return { id: id("expense"), title: "", category: "Operação", vendor: "", amount: 0, amountCents: 0, date: todayInputValue(), notes: "", createdAt: nowIso() };
}

function partTemplate(): Part {
  return { id: id("part"), name: "", invoiceIds: [], createdAt: nowIso() };
}

function revisionTemplate(partId: string): PartRevision {
  return { id: id("revision"), partId, title: "", version: "1", notes: "", attachments: [], invoiceIds: [], createdAt: nowIso() };
}

function TriageField({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`field-stack ${error ? "field-error" : ""}`}>
      <span>
        {label} {required && <b aria-hidden="true">*</b>}
      </span>
      {children}
      {error && <small><AlertCircle size={13} /> Preencha este campo para executar a triagem.</small>}
    </label>
  );
}

function ProductionBoard({ orders, onOpen, onMove }: { orders: Order[]; onOpen: (order: Order) => void; onMove: (order: Order, stage: ProductionStage) => void }) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const activeOrders = orders.filter((order) => order.status !== "Rascunho");
  return <div className="production-board-shell"><div className="production-board" role="list" aria-label="Funil de produção">{productionStages.map((stage) => { const cards = activeOrders.filter((order) => (order.productionStage ?? "planning") === stage.id); return <section className="production-column" key={stage.id} onDragOver={(event) => event.preventDefault()} onDrop={() => { const order = orders.find((item) => item.id === draggedId); if (order) onMove(order, stage.id); setDraggedId(null); }}><header className="production-column-header"><div><p className="eyebrow">{stage.detail}</p><h3>{stage.label}</h3></div><span>{cards.length}</span></header><div className="production-column-body">{cards.map((order) => <article className="production-card" key={order.id} draggable onDragStart={() => setDraggedId(order.id)} onDragEnd={() => setDraggedId(null)}><button type="button" className="production-card-main" onClick={() => onOpen(order)}><span className="production-card-type">{order.documentType}</span><strong>{order.title || "Sem título"}</strong><small>{order.clientName || "Cliente não definido"}</small><span className="production-card-meta">{order.dueDate ? `Entrega ${order.dueDate}` : "Sem entrega definida"} · {currency(order.total || 0)}</span></button><div className="production-card-actions"><button type="button" onClick={() => onMove(order, productionStages[Math.min(productionStages.length - 1, productionStages.findIndex((item) => item.id === stage.id) + 1)].id)} disabled={stage.id === "shipping"}>Avançar <ChevronRight size={14} /></button></div></article>)}{!cards.length && <p className="production-empty">Solte pedidos aqui</p>}</div></section>; })}</div></div>}

export default function Home({
  user,
  preview,
  onExit,
}: {
  user: User | null;
  preview: boolean;
  onExit: () => void;
}) {
  const [view, setView] = useState<ViewId>(() => {
    const requested = new URLSearchParams(window.location.search).get("view") as ViewId;
    const validViews: ViewId[] = ["overview", "estimates", "invoices", "orders", "production", "triage", "clients", "calendar", "inventory", "printers", "parts", "finance", "expenses", "more", "settings"];
    return preview && validViews.includes(requested) ? requested : "overview";
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [triages, setTriages] = useState<Triage[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [printers, setPrinters] = useState<PrinterModel[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [revisions, setRevisions] = useState<PartRevision[]>([]);
  const [clientModal, setClientModal] = useState<Client | null>(null);
  const [materialModal, setMaterialModal] = useState<Material | null>(null);
  const [catalogModal, setCatalogModal] = useState<CatalogItem | null>(null);
  const [calendarModal, setCalendarModal] = useState<CalendarEvent | null>(null);
  const [maintenancePrinter, setMaintenancePrinter] = useState<PrinterModel | null>(null);
  const [printerModal, setPrinterModal] = useState<PrinterModel | null>(null);
  const [orderModal, setOrderModal] = useState<Order | null>(null);
  const [newDocumentModal, setNewDocumentModal] = useState(false);
  const [expenseModal, setExpenseModal] = useState<Expense | null>(null);
  const [partModal, setPartModal] = useState<Part | null>(null);
  const [revisionModal, setRevisionModal] = useState<PartRevision | null>(null);
  const [triageErrors, setTriageErrors] = useState<string[]>([]);
  const [triageForm, setTriageForm] = useState({
    piece: "",
    objective: "",
    material: "",
    complexity: "",
    urgency: "",
    notes: "",
  });
  const [stockAdjustment, setStockAdjustment] = useState<Record<string, string>>({});
  const [teamEmail, setTeamEmail] = useState("");
  const [notice, setNotice] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTriggerRef = useRef<HTMLButtonElement>(null);

  const activeMaterials = materials.length ? materials : defaultMaterials;
  const activeCatalogItems = [...defaultCatalogItems.filter((item) => !catalogItems.some((saved) => saved.id === item.id)), ...catalogItems];
  const activePrinters = printers.length ? printers : defaultPrinters;
  const userName = displayName(user?.email);
  const greeting = greetingForEmail(user?.email);

  useEffect(() => {
    if (!user || preview) return;
    const subscriptions = [
      ["clients", setClients],
      ["materials", setMaterials],
      ["catalogItems", setCatalogItems],
      ["orders", setOrders],
      ["triages", setTriages],
      ["calendar", setEvents],
      ["printers", setPrinters],
      ["expenses", setExpenses],
      ["parts", setParts],
      ["partRevisions", setRevisions],
    ].map(([name, setter]) =>
      onSnapshot(
        workspaceCollection(name as string),
        (snapshot) => {
          (setter as React.Dispatch<React.SetStateAction<any[]>>)(
            snapshot.docs.map((item) => ({ id: item.id, ...item.data() })),
          );
        },
        () => setNotice("Não foi possível sincronizar uma área do espaço. Verifique sua conexão."),
      ),
    );
    return () => subscriptions.forEach((unsubscribe) => unsubscribe());
  }, [preview, user]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 4500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    if (!searchOpen) return;
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const previousScrollY = window.scrollY;
    const previousFocus = document.activeElement as HTMLElement | null;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
    const focusInput = window.requestAnimationFrame(() => searchInputRef.current?.focus());
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setSearchOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const panel = document.querySelector<HTMLElement>(".search-modal-panel");
      if (!panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>("button, input, [href], select, textarea, [tabindex]:not([tabindex=\"-1\"])"))
        .filter((element) => !element.hasAttribute("disabled"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusInput);
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      window.scrollTo(0, previousScrollY);
      window.removeEventListener("keydown", onKeyDown);
      (previousFocus ?? searchTriggerRef.current)?.focus();
    };
  }, [searchOpen]);

  const searchResults = useMemo(() => unifiedSearch(globalSearch, clients, orders), [clients, globalSearch, orders]);
  const schedule = useMemo(
    () => [...events].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [events],
  );
  const lowStock = activeMaterials.filter((material) => material.availableGrams <= material.reorderAtGrams);
  const outstanding = orders
    .filter((order) => order.status !== "Aprovado" && order.status !== "Em produção")
    .reduce((sum, order) => sum + Number(order.total || 0), 0);
  const nextAction = useMemo(() => nextFutureOrder(orders), [orders]);
  const stlAttachments = useMemo(() => orders.flatMap((order) => (order.attachments ?? []).filter((attachment) => attachment.name.toLowerCase().endsWith(".stl")).map((attachment) => ({ order, attachment }))), [orders]);
  const invoiceTotalCents = orders.filter((order) => order.documentType === "Invoice").reduce((sum, order) => sum + (order.totalCents ?? toCents(order.total)), 0);
  const receivedTotalCents = orders.filter((order) => order.documentType === "Invoice").flatMap((order) => order.payments ?? []).reduce((sum, payment) => sum + (payment.amountCents ?? toCents(payment.amount)), 0);
  const expenseTotalCents = expenses.reduce((sum, expense) => sum + (expense.amountCents ?? toCents(expense.amount)), 0);

  useEffect(() => {
    if (!preview) return;
    setMaterials((current) => current.length ? current : defaultMaterials);
    setPrinters((current) => current.length ? current : defaultPrinters);
  }, [preview]);

  async function deleteRecord(collectionName: string, recordId: string) {
    if (preview) return;
    await deleteDoc(doc(workspaceCollection(collectionName), recordId));
  }
  async function saveRecord(collectionName: string, record: { id: string; [key: string]: unknown }) {
    if (preview) return;
    const { id: recordId, ...rawData } = record;
    const data = JSON.parse(JSON.stringify(rawData)) as Record<string, unknown>;
    await setDoc(doc(workspaceCollection(collectionName), recordId), {
      ...data,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  }

  async function addEvent(event: CalendarEvent) {
    if (preview) {
      setEvents((current) => [event, ...current]);
      return;
    }
    await setDoc(doc(workspaceCollection("calendar"), event.id), {
      ...event,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  async function recordProcess(type: CalendarEvent["type"], title: string, detail: string) {
    await addEvent({ id: id("log"), type, title, detail, date: nowIso() });
  }

  function navigate(target: ViewId) {
    setView(target);
    setMobileOpen(false);
  }

  async function saveClient(client: Client) {
    if (!client.name.trim()) {
      setNotice("Informe o nome do cliente para salvar o cadastro.");
      return;
    }
    const nameParts = splitClientName(client.name);
    const saved = { ...client, ...nameParts, phone: formatUsPhone(client.phone), updatedAt: nowIso() };
    try {
      if (preview) {
        setClients((current) => {
          const index = current.findIndex((item) => item.id === saved.id);
          return index >= 0 ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current];
        });
      } else {
        await saveRecord("clients", saved);
      }
      await recordProcess("calendar", `Cliente atualizado: ${saved.name}`, "Cadastro de cliente criado ou alterado.");
      setClientModal(null);
      setNotice("Cliente salvo com todos os dados atualizados.");
    } catch {
      setNotice("Não foi possível salvar o cliente.");
    }
  }

  async function saveCatalogItem(item: CatalogItem) {
    const saved = { ...item, updatedAt: nowIso() };
    try {
      if (preview) setCatalogItems((current) => current.some((entry) => entry.id === saved.id) ? current.map((entry) => entry.id === saved.id ? saved : entry) : [saved, ...current]);
      else await saveRecord("catalogItems", saved);
      setCatalogModal(null);
      setNotice("Item do catálogo salvo.");
    } catch { setNotice("Não foi possível salvar o item do catálogo."); }
  }
  async function deleteCatalogItem(item: CatalogItem) {
    try {
      if (preview) setCatalogItems((current) => current.filter((entry) => entry.id !== item.id));
      else await deleteRecord("catalogItems", item.id);
      setCatalogModal(null);
      setNotice("Item removido do catálogo.");
    } catch { setNotice("Não foi possível remover o item do catálogo."); }
  }
  async function saveMaterial(material: Material) {
    if (!material.name.trim()) {
      setNotice("Informe o nome do filamento para salvar o estoque.");
      return;
    }
    try {
      if (preview) {
        setMaterials((current) => {
          const index = current.findIndex((item) => item.id === material.id);
          return index >= 0 ? current.map((item) => item.id === material.id ? material : item) : [material, ...current];
        });
      } else {
        await saveRecord("materials", material);
      }
      await recordProcess("inventory", `Estoque atualizado: ${material.name}`, `${material.availableGrams} g disponíveis.`);
      setMaterialModal(null);
      setNotice("Filamento salvo no estoque.");
    } catch {
      setNotice("Não foi possível salvar o filamento.");
    }
  }

  async function adjustStock(material: Material, direction: "in" | "out") {
    const amount = Number(stockAdjustment[material.id]);
    if (!amount || amount <= 0) {
      setNotice("Informe uma quantidade em gramas para movimentar o estoque.");
      return;
    }
    const next = Math.max(0, material.availableGrams + (direction === "in" ? amount : -amount));
    const changed = { ...material, availableGrams: next };
    try {
      if (preview) {
        setMaterials((current) => current.map((item) => item.id === material.id ? changed : item));
      } else {
        await saveRecord("materials", changed);
      }
      await recordProcess(
        "inventory",
        `${direction === "in" ? "Reposição" : "Consumo"}: ${material.name}`,
        `${direction === "in" ? "+" : "-"}${amount} g · saldo de ${next} g.`,
      );
      setStockAdjustment((current) => ({ ...current, [material.id]: "" }));
      setNotice("Movimentação registrada no estoque e no calendário.");
    } catch {
      setNotice("Não foi possível registrar a movimentação.");
    }
  }

  async function saveTriage() {
    const required = ["piece", "objective", "material", "complexity", "urgency"] as const;
    const errors = required.filter((key) => !triageForm[key].trim());
    setTriageErrors(errors);
    if (errors.length) {
      setNotice("Revise os campos destacados em vermelho antes de executar a triagem.");
      return;
    }
    const scale = { Baixa: 1, Média: 2, Alta: 3, Crítica: 4 };
    const triage: Triage = {
      id: id("triage"),
      ...triageForm,
      score: scale[triageForm.complexity as keyof typeof scale] + scale[triageForm.urgency as keyof typeof scale],
      createdAt: nowIso(),
    };
    try {
      if (preview) setTriages((current) => [triage, ...current]);
      else await saveRecord("triages", triage);
      await recordProcess("triage", `Triagem executada: ${triage.piece}`, `Objetivo: ${triage.objective}. Prioridade: ${triage.urgency}.`);
      setTriageForm({ piece: "", objective: "", material: "", complexity: "", urgency: "", notes: "" });
      setTriageErrors([]);
      setNotice("Triagem registrada e adicionada ao calendário operacional.");
    } catch {
      setNotice("Não foi possível salvar a triagem.");
    }
  }

  function createLine(service: OrderLine["service"], material: Material): OrderLine {
    const basic: OrderLine = {
      id: id("line"),
      service,
      kind: "service",
      taxable: false,
      unit: "horas",
      label: serviceLabels[service],
      quantity: 1,
      unitPrice: 0,
      description: "",
    };
    if (service === "scan") return { ...basic, quantity: 1, unitPrice: 85, description: "1 hora de escaneamento" };
    if (service === "cad") return { ...basic, quantity: 1, unitPrice: 75, description: "1 hora de CAD" };
    if (service === "print") {
      const unitPriceCents = printServicePrice({ pricePerGram: material.pricePerGram, weightGrams: 100, hours: 1 });
      return { ...basic, quantity: 1, unitPrice: centsToAmount(unitPriceCents), unitPriceCents, materialId: material.id, pricePerGram: material.pricePerGram, weightGrams: 100, printHours: 1, hourlyRate: 2.5, hourlyRateCents: 250, description: "1 h de máquina + 100 g de material" };
    }
    if (service === "post") return { ...basic, quantity: 1, unitPrice: 45, description: "Acabamento e preparação" };
    if (service === "hardware") return { ...basic, kind: "item", taxable: true, unit: "unidades", quantity: 1, unitPrice: 0, description: "Componentes aplicados no preenchimento" };
    if (service === "shipping") return { ...basic, quantity: 1, unitPrice: 0, description: "Frete definido no preenchimento" };
    return basic;
  }

  function prepareOrder(order: Order) {
    if (!order.clientId || !order.title.trim()) {
      setNotice("Selecione o cliente e descreva o item para salvar o documento.");
      return null;
    }
    const material = activeMaterials.find((item) => item.id === order.materialId) ?? activeMaterials[0];
    const client = clients.find((item) => item.id === order.clientId);
    const normalized = normalizeOrderMoney({
      ...order,
      clientName: client?.name ?? order.clientName,
      clientSnapshot: client ? {
        name: client.name,
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email,
        phone: client.phone,
        company: client.company,
        address: client.address,
      } : order.clientSnapshot,
      materialName: material.name,
      createdAt: order.createdAt || nowIso(),
      updatedAt: nowIso(),
    });
    const paymentError = validatePayments(normalized.totalCents ?? 0, normalized.payments ?? []);
    if (paymentError) {
      setNotice(paymentError);
      return null;
    }
    return { saved: normalized, material };
  }

  async function saveOrder(order: Order): Promise<boolean> {
    const prepared = prepareOrder(order);
    if (!prepared) return false;
    const { saved, material } = prepared;
    const previous = orders.find((item) => item.id === saved.id);
    const materialDelta = saved.materialGrams - (previous?.materialGrams ?? 0);
    try {
      if (preview) setOrders((current) => current.some((item) => item.id === saved.id) ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]);
      else {
        if (!materials.some((item) => item.id === material.id)) await saveRecord("materials", material);
        await saveRecord("orders", saved);
        if (materialDelta !== 0) {
          await updateDoc(doc(db, "workspaces", "reverso-private", "materials", material.id), {
            availableGrams: Math.max(0, material.availableGrams - materialDelta),
            updatedAt: serverTimestamp(),
          });
        }
      }
      await recordProcess(
        "order",
        `${saved.documentType} ${previous ? "atualizada" : "criada"}: ${saved.title}`,
        `${saved.clientName} · ${currency(saved.total)} · ${saved.materialGrams || 0} g de ${material.name}.`,
      );
      if (materialDelta !== 0) {
        await recordProcess("inventory", `Reserva ajustada: ${material.name}`, `${materialDelta > 0 ? "+" : ""}${materialDelta} g no documento ${saved.title}.`);
      }
      setOrderModal(null);
      setNotice(`${saved.documentType} salva com valores normalizados em centavos.`);
      return true;
    } catch {
      setNotice("Não foi possível salvar o documento. Verifique o material e sua conexão.");
      return false;
    }
  }

  async function moveProductionOrder(order: Order, productionStage: ProductionStage) {
    const changed = { ...order, productionStage, status: productionStage === "production" || productionStage === "quality" ? "Em produção" as const : order.status };
    try {
      if (preview) setOrders((current) => current.map((item) => item.id === order.id ? changed : item));
      else await saveRecord("orders", changed);
      await recordProcess("order", `Funil atualizado: ${changed.title}`, `Etapa: ${productionStages.find((stage) => stage.id === productionStage)?.label ?? productionStage}.`);
      setNotice(`Pedido movido para ${productionStages.find((stage) => stage.id === productionStage)?.label ?? "a próxima etapa"}.`);
    } catch { setNotice("Não foi possível mover o pedido no funil."); }
  }
  async function convertOrderToInvoice(order: Order): Promise<boolean> {
    const prepared = prepareOrder(order);
    if (!prepared || !isEstimate(prepared.saved)) return false;
    const existingInvoice = prepared.saved.invoiceId ? orders.find((item) => item.id === prepared.saved.invoiceId) : undefined;
    if (existingInvoice) {
      setOrderModal({ ...existingInvoice });
      setNotice("Esta estimativa já possui uma invoice vinculada.");
      return true;
    }
    const converted = createInvoiceFromEstimate(prepared.saved, id("invoice"), nowIso());
    try {
      if (preview) {
        setOrders((current) => [converted.invoice, ...current.filter((item) => item.id !== converted.estimate.id), converted.estimate]);
      } else {
        const batch = writeBatch(db);
        const estimateData = JSON.parse(JSON.stringify((({ id: _estimateId, ...data }: Order) => data)(converted.estimate)));
        const invoiceData = JSON.parse(JSON.stringify((({ id: _invoiceId, ...data }: Order) => data)(converted.invoice)));
        batch.set(doc(workspaceCollection("orders"), converted.estimate.id), { ...estimateData, updatedAt: serverTimestamp() }, { merge: true });
        batch.set(doc(workspaceCollection("orders"), converted.invoice.id), { ...invoiceData, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        await batch.commit();
      }
      await recordProcess("order", `Invoice criada: ${converted.invoice.title}`, `Convertida da estimativa ${converted.estimate.id}, preservando pagamentos, notas e anexos.`);
      setOrderModal({ ...converted.invoice });
      setNotice("Invoice criada e vinculada à estimativa sem perda de dados.");
      return true;
    } catch {
      setNotice("Não foi possível converter a estimativa em invoice.");
      return false;
    }
  }


  async function saveSelectorAnalysis(payload: Record<string, unknown>) {
    await saveRecord("materialAnalyses", payload as { id: string; [key: string]: unknown });
  }

  async function addSelectorAnalysisToDocument(payload: Record<string, unknown>, documentId: string) {
    const document = orders.find((item) => item.id === documentId);
    if (!document) {
      setNotice("Selecione um orçamento ou invoice válido para vincular a triagem.");
      return;
    }
    const ranking = payload.ranking as { primary?: { name?: string; score?: number; notes?: string } | null } | undefined;
    const recommendation = String(payload.recommendation ?? ranking?.primary?.name ?? "Sem recomendação segura");
    const score = Number(payload.score ?? ranking?.primary?.score ?? 0);
    const confidence = Number(payload.confidence ?? 0);
    const project = String(payload.project ?? "Projeto sem nome");
    const analysisId = String(payload.id);
    const line: OrderLine = {
      id: id("line"),
      service: "custom",
      kind: "service",
      taxable: false,
      unit: "unidades",
      label: "Triagem técnica de material",
      quantity: 1,
      unitPrice: 0,
      unitPriceCents: 0,
      description: `${project} · ${recommendation} · score ${score}/100 · confiança ${confidence}% · análise ${analysisId}`,
      triageAnalysisId: analysisId,
      triageRecommendation: recommendation,
      triageScore: score,
      triageConfidence: confidence,
    };
    const nextOrder: Order = {
      ...document,
      lines: [...(document.lines ?? []), line],
      notes: [document.notes, `Triagem técnica vinculada: ${recommendation} · ${project}.`].filter(Boolean).join("\n"),
    };
    if (!await saveOrder(nextOrder)) return;
    await saveSelectorAnalysis(payload);
    setNotice(`Triagem adicionada ao ${isEstimate(document) ? "orçamento" : "invoice"} ${document.title || "selecionado"}.`);
  }

  async function saveCalendarEvent(event: CalendarEvent) {
    if (!event.title.trim() || !event.date) {
      setNotice("Informe o título e a data do evento.");
      return;
    }
    try {
      await addEvent(event);
      setCalendarModal(null);
      setNotice("Evento adicionado ao calendário operacional.");
    } catch {
      setNotice("Não foi possível salvar o evento.");
    }
  }

  async function saveMaintenance(printer: PrinterModel, entry: MaintenanceEntry) {
    const nextPrinter: PrinterModel = {
      ...printer,
      lastMaintenance: entry.status === "Concluída" ? entry.date : printer.lastMaintenance,
      status: entry.status === "Agendada" ? "Em manutenção" : "Pronta",
      maintenance: [entry, ...(printer.maintenance ?? [])],
    };
    try {
      if (preview) {
        setPrinters((current) => current.map((item) => item.id === printer.id ? nextPrinter : item));
      } else {
        if (!printers.some((item) => item.id === printer.id)) await saveRecord("printers", nextPrinter);
        else await saveRecord("printers", nextPrinter);
      }
      await recordProcess("maintenance", `${printer.name}: ${entry.title}`, `${entry.status} · ${entry.notes || "Sem observações."}`);
      setMaintenancePrinter(null);
      setNotice("Manutenção registrada na impressora e no calendário.");
    } catch {
      setNotice("Não foi possível salvar a manutenção.");
    }
  }

  async function savePrinter(printer: PrinterModel) {
    if (!printer.name.trim() || !printer.model.trim()) { setNotice("Informe nome e modelo da impressora."); return; }
    try {
      if (preview) setPrinters((current) => current.some((item) => item.id === printer.id) ? current.map((item) => item.id === printer.id ? printer : item) : [printer, ...current]);
      else await saveRecord("printers", printer);
      setPrinterModal(null);
      setNotice("Perfil de impressora salvo com capacidade de processo.");
    } catch { setNotice("Não foi possível salvar o perfil da impressora."); }
  }

  async function saveExpense(expense: Expense) {
    if (!expense.title.trim() || !expense.date || !Number.isFinite(expense.amount) || expense.amount < 0) {
      setNotice("Informe título, data e um valor de despesa válido.");
      return;
    }
    const saved = { ...normalizeExpense(expense), updatedAt: nowIso() };
    try {
      if (preview) setExpenses((current) => current.some((item) => item.id === saved.id) ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]);
      else await saveRecord("expenses", saved);
      setExpenseModal(null);
      setNotice("Despesa salva e persistida.");
    } catch {
      setNotice("Não foi possível salvar a despesa.");
    }
  }

  async function savePart(part: Part) {
    if (!part.name.trim()) {
      setNotice("Informe o nome do objeto.");
      return;
    }
    const saved = { ...part, updatedAt: nowIso() };
    try {
      if (preview) setParts((current) => current.some((item) => item.id === saved.id) ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]);
      else await saveRecord("parts", saved);
      setPartModal(null);
      setNotice("Peça salva com seus vínculos de invoice.");
    } catch {
      setNotice("Não foi possível salvar a peça.");
    }
  }

  async function saveRevision(revision: PartRevision) {
    if (!revision.partId || !revision.title.trim() || !revision.version.trim()) {
      setNotice("Selecione a peça e informe título e versão.");
      return;
    }
    const saved = { ...revision, updatedAt: nowIso() };
    try {
      if (preview) setRevisions((current) => current.some((item) => item.id === saved.id) ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]);
      else await saveRecord("partRevisions", saved);
      const part = parts.find((item) => item.id === revision.partId);
      if (part) await savePart({ ...part, currentRevisionId: revision.id, invoiceIds: Array.from(new Set([...part.invoiceIds, ...revision.invoiceIds])) });
      setRevisionModal(null);
      setNotice("Revisão salva com arquivo, notas e vínculos.");
    } catch {
      setNotice("Não foi possível salvar a revisão.");
    }
  }

  async function authorizeTeamMember() {
    if (!teamEmail.trim()) return;
    try {
      await addWorkspaceEmail(teamEmail);
      setTeamEmail("");
      setNotice("Acesso autorizado para o e-mail informado.");
    } catch {
      setNotice("Não foi possível autorizar este e-mail.");
    }
  }

  const navigation: { id: ViewId; label: string; icon: typeof Box }[] = [
    { id: "overview", label: "Início", icon: Box },
    { id: "estimates", label: "Estimativas", icon: FileText },
    { id: "invoices", label: "Invoices", icon: CircleDollarSign },
    { id: "production", label: "Produção", icon: HardHat },
    { id: "triage", label: "Triagem técnica", icon: ClipboardCheck },
    { id: "more", label: "Mais", icon: Menu },
  ];
  const mobileNavigation = navigation.filter((item) => ["overview", "production", "estimates", "triage", "more"].includes(item.id));
  const viewLabels: Partial<Record<ViewId, string>> = {
    clients: "Clientes", calendar: "Calendário", inventory: "Estoque", printers: "Impressoras",
    parts: "Peças e revisões", finance: "Financeiro", expenses: "Despesas", settings: "Ajustes", orders: "Estimativas",
  };

  return (
    <div className="app-shell">
      {notice && <div className="notice" role="status"><Check size={16} /> {notice}</div>}
      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <button type="button" className="brand" onClick={() => navigate("overview")}>
          <span className="brand-mark">R</span>
          <span><b>REVERSO</b><em>WORKS</em></span>
        </button>
        <div className="sidebar-label">Operação</div>
        <nav>
          {navigation.map(({ id: navId, label, icon: Icon }) => (
            <button key={navId} className={view === navId ? "nav-active" : ""} type="button" onClick={() => navigate(navId)}>
              <Icon size={18} /> <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="profile-chip"><span>{userName.slice(0, 1).toUpperCase()}</span><div><b>{userName}</b><small>{preview ? "Modo de prévia" : user?.email}</small></div></div>
          <button className="sidebar-logout" type="button" onClick={() => { if (!preview) void signOut(auth); onExit(); }}><LogOut size={16} /> Sair</button>
        </div>
      </aside>
      {mobileOpen && <button className="mobile-scrim" aria-label="Fechar menu" onClick={() => setMobileOpen(false)} />}

      <main className="main-content">
        <header className="topbar">
          <button ref={searchTriggerRef} type="button" className="mobile-search icon-button" aria-label="Buscar" aria-haspopup="dialog" aria-expanded={searchOpen} onClick={() => setSearchOpen(true)}><Search size={19} /></button>
          <div className="topbar-title"><span>COMANDO TÉCNICO / 01</span><b>{navigation.find((item) => item.id === view)?.label ?? viewLabels[view]}</b></div>
          <div className="topbar-actions">
            <button type="button" className="button button-quiet" onClick={() => navigate("calendar")}><CalendarDays size={17} /><span>Calendário</span></button>
            <button type="button" className="button button-primary" onClick={() => setNewDocumentModal(true)}><Plus size={18} /> Novo pedido</button>
          </div>
        </header>

        {searchOpen && (
          <div className="search-modal-backdrop" role="presentation" onMouseDown={() => setSearchOpen(false)}>
            <section className="search-modal-panel" role="dialog" aria-modal="true" aria-labelledby="global-search-title" onMouseDown={(event) => event.stopPropagation()}>
              <div className="search-modal-heading">
                <div><p className="eyebrow">Busca unificada</p><h2 id="global-search-title">Localizar operação</h2></div>
                <button type="button" className="icon-button" aria-label="Fechar busca" onClick={() => setSearchOpen(false)}><X size={18} /></button>
              </div>
              <label className="search-modal-field">
                <span className="sr-only">Buscar estimativas, pedidos ou clientes</span>
                <Search size={18} aria-hidden="true" />
                <input ref={searchInputRef} value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} placeholder="Buscar pedidos, estimativas ou clientes…" autoComplete="off" inputMode="search" enterKeyHint="search" />
                {globalSearch && <button type="button" className="search-clear" aria-label="Limpar busca" onClick={() => setGlobalSearch("")}><X size={16} /></button>}
              </label>
              <div className="search-modal-results" aria-live="polite">
                {globalSearch.trim().length < 2 ? <p className="muted-copy">Digite pelo menos 2 caracteres para buscar.</p> : searchResults.length ? <div className="stack-list">{searchResults.map((result) => <button type="button" className="inline-action" key={`${result.kind}-${result.id}`} onClick={() => { if (result.kind === "client") setClientModal({ ...result.record }); else setOrderModal({ ...result.record }); setGlobalSearch(""); setSearchOpen(false); }}><span><b>{result.label}</b><small>{result.detail}</small></span><ChevronRight size={16} /></button>)}</div> : <p className="muted-copy">Nenhum resultado encontrado.</p>}
              </div>
            </section>
          </div>
        )}

        {view === "overview" && (
          <section className="view overview-view">
            <SectionHeader
              eyebrow={greeting}
              title="Controle a operação sem perder o ritmo."
              description="Pedidos, produção e memória técnica conectados em um único espaço de trabalho."
              action={<button type="button" className="button button-primary" onClick={() => setNewDocumentModal(true)}><FilePlus2 size={18} /> Novo pedido</button>}
            />
            <div className="hero-grid">
              <article className="command-card">
                <img className="command-card-image" src={technicalParts[0].image} alt="" aria-hidden="true" />
                <div className="command-card-copy">
                  <span className="signal"><Sparkles size={14} /> Centro de comando</span>
                  <h2>Da referência física à peça possível.</h2>
                  <p>Inicie um documento, registre uma triagem ou acompanhe o que a operação pede hoje.</p>
                  <div className="command-actions">
                    <button type="button" className="button button-primary" onClick={() => setNewDocumentModal(true)}>Novo pedido <ChevronRight size={16} /></button>
                    <button type="button" className="button button-secondary" onClick={() => navigate("triage")}><ClipboardCheck size={16} /> Executar triagem</button>
                  </div>
                </div>
                <div className="command-orbit"><div className="orbit-core"><ScanLine size={29} /><span>ENG</span></div></div>
              </article>
              <article className="triage-shortcut triage-shortcut-visual">
                <img className="triage-shortcut-image" src={technicalParts[2].image} alt="" aria-hidden="true" />
                <div className="triage-shortcut-content">
                  <div className="shortcut-icon"><ClipboardCheck size={22} /></div>
                  <p className="eyebrow">Acesso rápido</p>
                  <h3>Triagem técnica</h3>
                  <p>Decida viabilidade, material e prioridade antes de abrir a fila.</p>
                  <button type="button" className="inline-action" onClick={() => navigate("triage")}>Abrir triagem <ChevronRight size={16} /></button>
                </div>
              </article>
            </div>
            <div className="metric-grid">
              <article className="metric-card"><span>Documentos ativos</span><strong>{orders.length}</strong><small><FileText size={13} /> {orders.filter((item) => item.status === "Em produção").length} em produção</small></article>
              <article className="metric-card"><span>A receber</span><strong>{currency(outstanding)}</strong><small><CircleDollarSign size={13} /> documentos em rascunho ou enviados</small></article>
              <article className="metric-card"><span>Estoque crítico</span><strong>{lowStock.length}</strong><small><Layers3 size={13} /> filamentos abaixo do limite</small></article>
              <article className="metric-card"><span>Logs recentes</span><strong>{events.length}</strong><small><CalendarDays size={13} /> eventos visuais no calendário</small></article>
            </div>
            <div className="overview-bottom">
              <article className="panel-card agenda-panel">
                <div className="panel-title"><div><p className="eyebrow">Agenda de produção</p><h3>Últimos movimentos</h3></div><button type="button" className="button button-quiet" onClick={() => navigate("calendar")}>Ver calendário</button></div>
                {nextAction && <div className="empty-state"><div className="empty-icon"><Clock3 size={20} /></div><div><strong>Próxima ação · {nextAction.dueDate}</strong><p>{nextAction.clientName} · {nextAction.title}</p></div><button type="button" className="button button-secondary" onClick={() => setOrderModal({ ...nextAction })}>Continuar pedido</button></div>}
                {schedule.length ? <div className="timeline-list">{schedule.slice(0, 4).map((event) => <div className="timeline-item" key={event.id}><span className={`event-dot event-${event.type}`} /><div><b>{event.title}</b><p>{event.detail}</p></div><time>{dayLabel(event.date)}</time></div>)}</div> : <EmptyState icon={CalendarDays} title="Sua agenda está livre" body="Todo pedido, triagem, consumo ou manutenção aparecerá aqui como registro visual." action={<button type="button" className="button button-secondary" onClick={() => setCalendarModal(calendarTemplate())}>Adicionar evento</button>} />}
              </article>
              <article className="panel-card printer-summary">
                <div className="panel-title"><div><p className="eyebrow">Fábrica</p><h3>{activePrinters[0]?.name}</h3></div><span className="status-ready">{activePrinters[0]?.status}</span></div>
                <div className="printer-detail"><Printer size={22} /><div><b>{activePrinters[0]?.model}</b><p>Última manutenção: {activePrinters[0]?.lastMaintenance || "não registrada"}</p></div></div>
                <button type="button" className="inline-action" onClick={() => navigate("printers")}>Gerenciar manutenção <ChevronRight size={16} /></button>
              </article>
            </div>
            <div className="quick-cards">
              <button type="button" onClick={() => navigate("clients")}><UsersRound size={18} /><span>Clientes</span><small>{clients.length} cadastrados</small></button>
              <button type="button" onClick={() => navigate("parts")}><PackageOpen size={18} /><span>Peças</span><small>{stlAttachments.length} arquivos .STL</small></button>
              <button type="button" onClick={() => navigate("calendar")}><CalendarDays size={18} /><span>Calendário</span><small>{events.length} logs</small></button>
              <button type="button" onClick={() => navigate("settings")}><Settings2 size={18} /><span>Ajustes</span><small>Equipe e acesso</small></button>
            </div>
          </section>
        )}

        {view === "clients" && (
          <section className="view">
            <SectionHeader eyebrow="Relacionamento" title="Clientes" description="Cadastros completos, acessíveis e editáveis tanto no desktop quanto no celular." action={<button type="button" className="button button-primary" onClick={() => setClientModal(clientTemplate())}><Plus size={17} /> Novo cliente</button>} />
            <div className="client-grid">
              {clients.map((client) => <article className="client-card" key={client.id}><div className="client-avatar">{client.name.slice(0, 1).toUpperCase()}</div><div className="client-data"><h3>{client.name}</h3><p>{client.company || "Pessoa física"}</p><span>{client.phone || "Sem telefone"}</span><span>{client.email || "Sem e-mail"}</span></div><button type="button" className="icon-button card-edit" aria-label={`Editar ${client.name}`} onClick={() => setClientModal({ ...client })}><Pencil size={16} /></button></article>)}
              {!clients.length && <EmptyState icon={UsersRound} title="Nenhum cliente cadastrado" body="Adicione o primeiro cliente; no celular, você pode visualizar, criar e editar o cadastro completo." action={<button type="button" className="button button-primary" onClick={() => setClientModal(clientTemplate())}>Cadastrar cliente</button>} />}
            </div>
          </section>
        )}

        {view === "triage" && (
          <section className="view triage-view">
            <SectionHeader eyebrow="Decisão técnica" title="Seletor de Materiais" description="Reverso Material Selector v3 · material, processo, geometria e ambiente em uma decisão rastreável." />
            <MaterialSelector stock={activeMaterials} printers={activePrinters} documents={orders.filter((order) => isEstimate(order) || order.documentType === "Invoice")} onSave={saveSelectorAnalysis} onAddToDocument={addSelectorAnalysisToDocument} onNotice={setNotice} />
          </section>
        )}

        {(view === "orders" || view === "estimates" || view === "invoices") && (
          <section className="view">
            <SectionHeader eyebrow="Comercial" title={view === "invoices" ? "Invoices" : "Estimativas"} description="Documentos conectados ao cliente, itens, serviços, pagamentos, notas e arquivos." action={<button type="button" className="button button-primary" onClick={() => view === "estimates" ? setOrderModal(orderTemplate(activeMaterials[0], "Estimativa")) : view === "invoices" ? setOrderModal(orderTemplate(activeMaterials[0], "Invoice")) : setNewDocumentModal(true)}><Plus size={17} /> Novo pedido</button>} />
            <div className="order-list">
              {orders.filter((order) => {
                const term = globalSearch.trim().toLocaleLowerCase();
                const typeMatches = view === "invoices" ? order.documentType === "Invoice" : isEstimate(order);
                return typeMatches && (!term || `${order.title} ${order.clientName} ${order.documentType}`.toLocaleLowerCase().includes(term));
              }).map((order) => <article className="order-card" key={order.id}><div className="order-symbol">{order.documentType === "Invoice" ? <CircleDollarSign size={21} /> : <FileText size={21} />}</div><div className="order-main"><div className="order-title"><span>{isEstimate(order) ? "Estimativa" : "Invoice"}</span><h3>{order.title}</h3></div><p>{order.clientName} · {order.materialName || "Material não definido"}</p><small><Clock3 size={13} /> Entrega: {order.dueDate || "a definir"}</small></div><div className="order-value"><strong>{currency(order.total)}</strong><span>{order.status}</span></div><div className="order-actions"><button className="icon-button" type="button" aria-label="Abrir documento" onClick={() => setOrderModal({ ...order })}><Eye size={16} /></button>{order.documentType === "Invoice" && <button className="icon-button" type="button" aria-label="Imprimir invoice" onClick={() => downloadInvoicePdf(order)}><FileDown size={16} /></button>}</div></article>)}
              {!orders.some((order) => view === "invoices" ? order.documentType === "Invoice" : isEstimate(order)) && <EmptyState icon={FilePlus2} title={`Nenhuma ${view === "invoices" ? "invoice" : "estimativa"} criada`} body="Crie um documento com itens, serviços, pagamentos, notas e anexos." action={<button type="button" className="button button-primary" onClick={() => view === "estimates" ? setOrderModal(orderTemplate(activeMaterials[0], "Estimativa")) : view === "invoices" ? setOrderModal(orderTemplate(activeMaterials[0], "Invoice")) : setNewDocumentModal(true)}>Criar documento</button>} />}
            </div>
          </section>
        )}

        {view === "production" && (
          <section className="view">
            <SectionHeader eyebrow="Produção" title="Invoices em produção" description="Selecione uma invoice para abrir detalhes completos, modificar, anexar arquivos ou imprimir." />
            <div className="order-list">{orders.filter((order) => order.documentType === "Invoice").map((order) => <article className="order-card" key={order.id}><div className="order-symbol"><HardHat size={21} /></div><div className="order-main"><div className="order-title"><span>{order.status}</span><h3>{order.title}</h3></div><p>{order.clientName}</p><small><Clock3 size={13} /> Entrega: {order.dueDate || "a definir"}</small></div><div className="order-value"><strong>{currency(order.total)}</strong><span>{(order.attachments ?? []).length} anexo(s)</span></div><div className="order-actions"><button className="icon-button" type="button" aria-label="Abrir invoice" onClick={() => setOrderModal({ ...order })}><Eye size={16} /></button><button className="icon-button" type="button" aria-label="Imprimir invoice" onClick={() => downloadInvoicePdf(order)}><FileDown size={16} /></button></div></article>)}</div>
          </section>
        )}

        {view === "calendar" && (
          <section className="view">
            <SectionHeader eyebrow="Registro visual" title="Calendário operacional" description="Eventos manuais e logs de triagem, pedidos, estoque e manutenção reunidos em uma linha do tempo legível." action={<button type="button" className="button button-primary" onClick={() => setCalendarModal(calendarTemplate())}><Plus size={17} /> Novo evento</button>} />
            <div className="calendar-layout">
              <article className="panel-card calendar-card"><div className="calendar-title"><CalendarDays size={20} /><div><h3>Registro da operação</h3><p>Cada etapa relevante deixa uma marca visual.</p></div></div>{schedule.length ? <div className="calendar-stream">{schedule.map((event) => <div className="calendar-event" key={event.id}><time><b>{dayLabel(event.date)}</b><span>{new Date(event.date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span></time><span className={`event-dot event-${event.type}`} /><div><h3>{event.title}</h3><p>{event.detail}</p></div><span className="event-tag">{event.type}</span></div>)}</div> : <EmptyState icon={CalendarDays} title="Sem eventos ainda" body="Crie um evento ou salve uma parte do processo para começar o histórico visual." />}</article>
              <article className="panel-card calendar-guide"><p className="eyebrow">Automático</p><h3>O que gera log</h3><ul><li><ClipboardCheck size={16} /> Triagens executadas</li><li><FileText size={16} /> Orçamentos e invoices</li><li><Layers3 size={16} /> Consumo e reposição</li><li><Wrench size={16} /> Manutenções</li></ul></article>
            </div>
          </section>
        )}

        {view === "production" && (
          <section className="view production-view">
            <SectionHeader eyebrow="Fábrica / Funil operacional" title="Produção em fluxo" description="Da triagem ao envio, cada pedido avança por uma etapa clara e rastreável." action={<button type="button" className="button button-primary" onClick={() => navigate("triage")}><ClipboardCheck size={17} /> Nova triagem</button>} />
            <ProductionBoard orders={orders} onOpen={(order) => setOrderModal({ ...order })} onMove={(order, stage) => void moveProductionOrder(order, stage)} />
          </section>
        )}
        {view === "inventory" && (
          <section className="view">
            <SectionHeader eyebrow="Fábrica" title="Estoque de filamentos" description="Acompanhe disponível, limite de reposição e consumo aplicado a protótipos ou produtos." action={<button type="button" className="button button-primary" onClick={() => setMaterialModal(materialTemplate())}><Plus size={17} /> Adicionar filamento</button>} />
            <div className="inventory-grid">
              {activeMaterials.map((material) => <article className={`material-card ${material.availableGrams <= material.reorderAtGrams ? "material-alert" : ""}`} key={material.id}><div className="material-header"><div><span className="material-swatch" style={{ background: material.color.toLowerCase() === "natural" ? "#dccaa5" : material.color.toLowerCase() }} /><p className="eyebrow">{material.type || "Filamento"}</p><h3>{material.name}</h3></div><button type="button" className="icon-button" aria-label={`Editar ${material.name}`} onClick={() => setMaterialModal({ ...material })}><Pencil size={16} /></button></div><div className="stock-number"><strong>{material.availableGrams}</strong><span>g disponíveis</span></div><div className="stock-meter"><span style={{ width: `${Math.min(100, Math.max(8, (material.availableGrams / Math.max(material.reorderAtGrams * 3, 1)) * 100))}%` }} /></div><div className="stock-meta"><span>Reposição em {material.reorderAtGrams} g</span><b>{currency(material.pricePerGram)}/g</b></div><div className="stock-adjust"><input inputMode="numeric" value={stockAdjustment[material.id] ?? ""} onChange={(event) => setStockAdjustment({ ...stockAdjustment, [material.id]: event.target.value.replace(/\D/g, "") })} placeholder="gramas" /><button type="button" title="Repor" onClick={() => void adjustStock(material, "in")}><ArrowUpFromLine size={16} /></button><button type="button" title="Consumir" onClick={() => void adjustStock(material, "out")}><ArrowDownToLine size={16} /></button></div><div className="material-specs"><span>Bico: {material.nozzleTemp || "—"}</span><span>Mesa: {material.bedTemp || "—"}</span></div></article>)}
            </div>
          </section>
        )}

        {view === "printers" && (
          <section className="view">
            <SectionHeader eyebrow="Fábrica" title="Gerenciamento de manutenção" description="Cada impressora tem histórico próprio, capacidade de processo e intervenções rastreáveis." action={<button type="button" className="button button-primary" onClick={() => setPrinterModal(printerTemplate())}><Plus size={17} /> Nova impressora</button>} />
            <div className="printer-grid">{activePrinters.map((printer) => <article className="printer-card" key={printer.id}><div className="printer-top"><div className="printer-icon"><Printer size={26} /></div><div><p className="eyebrow">{printer.model}</p><h3>{printer.name}</h3></div><button type="button" className="icon-button" aria-label={`Editar ${printer.name}`} onClick={() => setPrinterModal({ ...printer })}><Pencil size={16} /></button><span className={printer.status === "Pronta" ? "status-ready" : "status-alert"}>{printer.status}</span></div><div className="printer-facts"><div><span>Material atual</span><b>{printer.material || "Não definido"}</b></div><div><span>Última manutenção</span><b>{printer.lastMaintenance || "Não registrada"}</b></div><div><span>Nozzle máximo</span><b>{printer.maxNozzleTemp ? `${printer.maxNozzleTemp} °C` : "Não informado"}</b></div><div><span>Câmara máxima</span><b>{printer.maxChamberTemp ? `${printer.maxChamberTemp} °C` : "Não informada"}</b></div><div><span>Volume útil</span><b>{printer.buildVolume || "Não informado"}</b></div><div><span>Bico endurecido</span><b>{printer.hardenedNozzle ? "Disponível" : "Não disponível"}</b></div></div><div className="maintenance-preview">{printer.maintenance?.length ? printer.maintenance.slice(0, 2).map((entry) => <p key={entry.id}><Wrench size={14} /> {entry.title} <time>{entry.date}</time></p>) : <p><Cog size={14} /> Nenhuma manutenção registrada.</p>}</div><button type="button" className="button button-secondary full-width" onClick={() => setMaintenancePrinter(printer)}><Wrench size={17} /> Gerenciar manutenção</button></article>)}</div>
          </section>
        )}

        {view === "parts" && (
          <section className="view">
            <SectionHeader eyebrow="Memória técnica" title="Peças e revisões" description="Objetos, versões, arquivos .STL, notas e invoices relacionados." action={<button type="button" className="button button-primary" onClick={() => setPartModal(partTemplate())}><Plus size={17} /> Nova peça</button>} />
            <div className="order-list">
              {parts.map((part) => <article className="panel-card" key={part.id}><div className="panel-title"><div><p className="eyebrow">Objeto</p><h3>{part.name}</h3></div><div className="order-actions"><button type="button" className="button button-secondary" onClick={() => setRevisionModal(revisionTemplate(part.id))}><Plus size={15} /> Revisão</button><button type="button" className="icon-button" aria-label={`Modificar ${part.name}`} onClick={() => setPartModal({ ...part })}><Pencil size={16} /></button></div></div><div className="stack-list">{revisions.filter((revision) => revision.partId === part.id).map((revision) => <button type="button" className="inline-action" key={revision.id} onClick={() => setRevisionModal({ ...revision, attachments: [...revision.attachments], invoiceIds: [...revision.invoiceIds] })}><span><b>{revision.title} · v{revision.version}</b><small>{revision.notes || "Sem notas"} · {revision.attachments.length} arquivo(s)</small></span><ChevronRight size={16} /></button>)}</div></article>)}
              {!!stlAttachments.length && <article className="panel-card"><div className="panel-title"><div><p className="eyebrow">Arquivos anexados</p><h3>Peças .STL de invoices</h3></div></div><div className="stack-list">{stlAttachments.filter(({ order }) => order.documentType === "Invoice").map(({ order, attachment }) => <button type="button" className="inline-action" key={`${order.id}-${attachment.id ?? attachment.name}`} onClick={() => setOrderModal({ ...order })}><span><b>{attachment.name}</b><small>{order.clientName} · {order.title}</small></span><ChevronRight size={16} /></button>)}</div></article>}
              {!parts.length && !stlAttachments.length && <EmptyState icon={PackageOpen} title="Nenhuma peça registrada" body="Crie um objeto ou anexe um .STL a uma invoice para iniciar a memória técnica." />}
            </div>
          </section>
        )}

        {view === "finance" && (
          <section className="view">
            <SectionHeader eyebrow="Mais" title="Financeiro" description="Visão preservada de invoices, recebimentos e despesas." />
            <div className="metric-grid"><article className="metric-card"><span>Invoices</span><strong>{currency(centsToAmount(invoiceTotalCents))}</strong><small>{orders.filter((order) => order.documentType === "Invoice").length} registros</small></article><article className="metric-card"><span>Recebido</span><strong>{currency(centsToAmount(receivedTotalCents))}</strong><small>Pagamentos registrados</small></article><article className="metric-card"><span>A receber</span><strong>{currency(centsToAmount(Math.max(0, invoiceTotalCents - receivedTotalCents)))}</strong><small>Saldo das invoices</small></article><article className="metric-card"><span>Despesas</span><strong>{currency(centsToAmount(expenseTotalCents))}</strong><small>{expenses.length} registros</small></article></div>
            <div className="quick-cards"><button type="button" onClick={() => navigate("invoices")}><CircleDollarSign size={18} /><span>Invoices</span><small>Abrir documentos</small></button><button type="button" onClick={() => navigate("expenses")}><FileDown size={18} /><span>Despesas</span><small>Criar e modificar</small></button></div>
          </section>
        )}

        {view === "expenses" && (
          <section className="view">
            <SectionHeader eyebrow="Financeiro" title="Despesas" description="Registros persistidos com categoria, fornecedor, valor e data." action={<button type="button" className="button button-primary" onClick={() => setExpenseModal(expenseTemplate())}><Plus size={17} /> Nova despesa</button>} />
            <div className="order-list">{expenses.map((expense) => <article className="order-card" key={expense.id}><div className="order-symbol"><CircleDollarSign size={21} /></div><div className="order-main"><div className="order-title"><span>{expense.category}</span><h3>{expense.title}</h3></div><p>{expense.vendor || "Sem fornecedor"}</p><small>{expense.date}</small></div><div className="order-value"><strong>{currency(centsToAmount(expense.amountCents ?? toCents(expense.amount)))}</strong></div><button type="button" className="icon-button" aria-label={`Modificar ${expense.title}`} onClick={() => setExpenseModal({ ...expense })}><Pencil size={16} /></button></article>)}</div>
          </section>
        )}

        {view === "more" && (
          <section className="view">
            <SectionHeader eyebrow="Navegação" title="Mais" description="Cadastros, financeiro, memória técnica e operação de apoio." />
            <div className="quick-cards"><button type="button" onClick={() => navigate("clients")}><UsersRound size={18} /><span>Clientes</span><small>{clients.length} cadastrados</small></button><button type="button" onClick={() => navigate("finance")}><CircleDollarSign size={18} /><span>Financeiro</span><small>Invoices e despesas</small></button><button type="button" onClick={() => navigate("parts")}><PackageOpen size={18} /><span>Peças e revisões</span><small>{parts.length} objetos</small></button><button type="button" onClick={() => navigate("calendar")}><CalendarDays size={18} /><span>Calendário</span><small>{events.length} eventos</small></button><button type="button" onClick={() => navigate("inventory")}><Layers3 size={18} /><span>Estoque</span><small>{activeMaterials.length} materiais</small></button><button type="button" onClick={() => navigate("printers")}><Printer size={18} /><span>Impressoras</span><small>{activePrinters.length} máquinas</small></button><button type="button" onClick={() => navigate("settings")}><Settings2 size={18} /><span>Ajustes</span><small>Equipe e acesso</small></button></div>
          </section>
        )}

        {view === "settings" && (
          <section className="view">
            <SectionHeader eyebrow="Acesso privado" title="Equipe e configuração" description="Somente e-mails autorizados podem abrir os dados operacionais deste espaço." />
            <div className="settings-grid"><article className="panel-card catalog-settings-card"><div className="settings-card-heading"><div><p className="eyebrow">Catálogo comercial</p><h3>Itens e serviços</h3></div><button type="button" className="button button-secondary" onClick={() => setCatalogModal({ id: id("catalog"), name: "", description: "", unitPrice: 0, taxable: true, kind: "item" })}><Plus size={15} /> Adicionar item</button></div><p className="muted-copy">Cadastre os itens que aparecem no documento. O preço unitário será aplicado automaticamente ao selecionar o item.</p><div className="catalog-list">{activeCatalogItems.map((item) => <div className="catalog-list-row" key={item.id}><div><b>{item.name}</b><small>{item.description || "Sem descrição"}</small></div><strong>{currency(item.unitPrice)}</strong><button type="button" className="icon-button" aria-label={`Editar ${item.name}`} onClick={() => setCatalogModal({ ...item })}><Pencil size={15} /></button></div>)}</div></article><article className="panel-card"><p className="eyebrow">Equipe do espaço</p><h3>Autorizar integrante</h3><p className="muted-copy">A conta atual é exibida com nome personalizado: Lincoln para Lincoln e Duda para Eduarda.</p><div className="team-member"><span>{userName.slice(0, 1).toUpperCase()}</span><div><b>{userName}</b><p>{user?.email || "Prévia da interface"}</p></div><em>Ativo</em></div>{!preview && <div className="team-form"><input type="email" value={teamEmail} onChange={(event) => setTeamEmail(event.target.value)} placeholder="E-mail da integrante" /><button type="button" className="button button-primary" onClick={() => void authorizeTeamMember()}>Autorizar acesso</button></div>}</article><article className="panel-card"><p className="eyebrow">Princípios de operação</p><h3>Registros rastreáveis</h3><ul className="settings-list"><li><Check size={16} /> Telefone formatado em padrão americano</li><li><Check size={16} /> Toda etapa relevante cria um evento visual</li><li><Check size={16} /> Consumo do material é abatido ao salvar o documento</li></ul></article></div>
          </section>
        )}
      </main>

      <nav className="mobile-nav" aria-label="Navegação móvel">{mobileNavigation.map(({ id: navId, label, icon: Icon }) => <button key={navId} className={view === navId ? "mobile-active" : ""} type="button" onClick={() => navigate(navId)}><Icon size={19} /><span>{label.replace(" técnica", "")}</span></button>)}</nav>

      {clientModal && <ClientDialog client={clientModal} onChange={setClientModal} onClose={() => setClientModal(null)} onSave={saveClient} />}
      {catalogModal && <CatalogItemDialog item={catalogModal} onChange={setCatalogModal} onClose={() => setCatalogModal(null)} onSave={saveCatalogItem} onDelete={deleteCatalogItem} />}
      {materialModal && <MaterialDialog material={materialModal} onChange={setMaterialModal} onClose={() => setMaterialModal(null)} onSave={saveMaterial} />}
      {printerModal && <PrinterDialog printer={printerModal} onChange={setPrinterModal} onClose={() => setPrinterModal(null)} onSave={savePrinter} />}
      {calendarModal && <CalendarDialog event={calendarModal} onChange={setCalendarModal} onClose={() => setCalendarModal(null)} onSave={saveCalendarEvent} />}
      {maintenancePrinter && <MaintenanceDialog printer={maintenancePrinter} onClose={() => setMaintenancePrinter(null)} onSave={saveMaintenance} />}
      {newDocumentModal && <NewDocumentDialog onClose={() => setNewDocumentModal(false)} onSelect={(documentType) => { setNewDocumentModal(false); setOrderModal(orderTemplate(activeMaterials[0], documentType)); }} />}
      {orderModal && <DocumentDialog order={orderModal} existing={orders.some((item) => item.id === orderModal.id)} authenticated={Boolean(user) && !preview} clients={clients} materials={activeMaterials} catalogItems={activeCatalogItems} onChange={setOrderModal} onClose={() => setOrderModal(null)} onSave={saveOrder} onConvert={convertOrderToInvoice} onPrint={downloadInvoicePdf} createLine={createLine} />}
      {expenseModal && <ExpenseDialog expense={expenseModal} onChange={setExpenseModal} onClose={() => setExpenseModal(null)} onSave={saveExpense} />}
      {partModal && <PartDialog part={partModal} invoices={orders.filter((order) => order.documentType === "Invoice")} onChange={setPartModal} onClose={() => setPartModal(null)} onSave={savePart} />}
      {revisionModal && <RevisionDialog revision={revisionModal} parts={parts} invoices={orders.filter((order) => order.documentType === "Invoice")} preview={preview} onChange={setRevisionModal} onClose={() => setRevisionModal(null)} onSave={saveRevision} />}
    </div>
  );
}

function ExpenseDialog({ expense, onChange, onClose, onSave }: { expense: Expense; onChange: (expense: Expense) => void; onClose: () => void; onSave: (expense: Expense) => Promise<void> }) {
  return <Modal title={expense.title ? "Modificar despesa" : "Nova despesa"} onClose={onClose}><div className="dialog-form"><label className="field-stack field-span"><span>Título *</span><input value={expense.title} onChange={(event) => onChange({ ...expense, title: event.target.value })} /></label><label className="field-stack"><span>Categoria</span><input value={expense.category} onChange={(event) => onChange({ ...expense, category: event.target.value })} /></label><label className="field-stack"><span>Fornecedor</span><input value={expense.vendor} onChange={(event) => onChange({ ...expense, vendor: event.target.value })} /></label><label className="field-stack"><span>Valor *</span><input type="number" min="0" step="0.01" value={expense.amount || ""} onChange={(event) => onChange({ ...expense, amount: Number(event.target.value), amountCents: toCents(event.target.value) })} /></label><label className="field-stack"><span>Data *</span><input type="date" value={expense.date} onChange={(event) => onChange({ ...expense, date: event.target.value })} /></label><label className="field-stack field-span"><span>Notas</span><textarea value={expense.notes} onChange={(event) => onChange({ ...expense, notes: event.target.value })} /></label></div><div className="dialog-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancelar</button><button type="button" className="button button-primary" onClick={() => void onSave(expense)}>Salvar</button></div></Modal>;
}

function PartDialog({ part, invoices, onChange, onClose, onSave }: { part: Part; invoices: Order[]; onChange: (part: Part) => void; onClose: () => void; onSave: (part: Part) => Promise<void> }) {
  return <Modal title={part.name ? "Modificar peça" : "Nova peça"} onClose={onClose}><div className="dialog-form"><label className="field-stack field-span"><span>Nome do objeto *</span><input value={part.name} onChange={(event) => onChange({ ...part, name: event.target.value })} /></label><div className="field-stack field-span"><span>Invoices relacionadas</span>{invoices.map((invoice) => <label key={invoice.id}><input type="checkbox" checked={part.invoiceIds.includes(invoice.id)} onChange={(event) => onChange({ ...part, invoiceIds: event.target.checked ? [...part.invoiceIds, invoice.id] : part.invoiceIds.filter((idValue) => idValue !== invoice.id) })} /> {invoice.clientName} · {invoice.title}</label>)}</div></div><div className="dialog-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancelar</button><button type="button" className="button button-primary" onClick={() => void onSave(part)}>Salvar</button></div></Modal>;
}

function RevisionDialog({ revision, parts, invoices, preview, onChange, onClose, onSave }: { revision: PartRevision; parts: Part[]; invoices: Order[]; preview: boolean; onChange: (revision: PartRevision) => void; onClose: () => void; onSave: (revision: PartRevision) => Promise<void> }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  async function attach(file?: File) {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const attachment = preview ? { id: id("attachment"), name: file.name, size: file.size, contentType: "model/stl", uploadedAt: nowIso() } : await uploadStlAttachment(revision.id, file);
      onChange({ ...revision, attachments: [...revision.attachments, attachment] });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Não foi possível anexar o arquivo.");
    } finally {
      setUploading(false);
    }
  }
  return <Modal title="Detalhes da revisão" onClose={onClose}><div className="dialog-form"><label className="field-stack"><span>Peça *</span><select value={revision.partId} onChange={(event) => onChange({ ...revision, partId: event.target.value })}>{parts.map((part) => <option key={part.id} value={part.id}>{part.name}</option>)}</select></label><label className="field-stack"><span>Versão *</span><input value={revision.version} onChange={(event) => onChange({ ...revision, version: event.target.value })} /></label><label className="field-stack field-span"><span>Título da versão *</span><input value={revision.title} onChange={(event) => onChange({ ...revision, title: event.target.value })} /></label><label className="field-stack field-span"><span>Notas</span><textarea value={revision.notes} onChange={(event) => onChange({ ...revision, notes: event.target.value })} /></label><div className="field-stack field-span"><span>Invoices relacionadas</span>{invoices.map((invoice) => <label key={invoice.id}><input type="checkbox" checked={revision.invoiceIds.includes(invoice.id)} onChange={(event) => onChange({ ...revision, invoiceIds: event.target.checked ? [...revision.invoiceIds, invoice.id] : revision.invoiceIds.filter((idValue) => idValue !== invoice.id) })} /> {invoice.clientName} · {invoice.title}</label>)}</div><label className="button button-secondary field-span"><Paperclip size={16} /> {uploading ? "Enviando…" : "Anexar arquivo .STL"}<input hidden type="file" accept=".stl,model/stl" disabled={uploading} onChange={(event) => void attach(event.target.files?.[0])} /></label>{error && <small className="inline-warning field-span">{error}</small>}<div className="stack-list field-span">{revision.attachments.map((attachment) => <a key={attachment.id ?? attachment.name} href={attachment.downloadUrl} target="_blank" rel="noreferrer">{attachment.name}</a>)}</div></div><div className="dialog-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancelar</button><button type="button" className="button button-primary" disabled={uploading} onClick={() => void onSave(revision)}>Salvar revisão</button></div></Modal>;
}

function ClientDialog({ client, onChange, onClose, onSave }: { client: Client; onChange: (client: Client) => void; onClose: () => void; onSave: (client: Client) => Promise<void> }) {
  const fallback = splitClientName(client.name);
  const firstName = client.firstName ?? fallback.firstName;
  const lastName = client.lastName ?? fallback.lastName;
  function updateName(nextFirstName: string, nextLastName: string) {
    onChange({ ...client, firstName: nextFirstName, lastName: nextLastName, name: `${nextFirstName} ${nextLastName}`.trim() });
  }
  return <Modal title={client.name ? "Editar cliente" : "Novo cliente"} onClose={onClose}><div className="dialog-form"><label className="field-stack"><span>Primeiro nome *</span><input value={firstName} onChange={(event) => updateName(event.target.value, lastName)} placeholder="Nome" /></label><label className="field-stack"><span>Último nome</span><input value={lastName} onChange={(event) => updateName(firstName, event.target.value)} placeholder="Sobrenome" /></label><label className="field-stack"><span>Empresa</span><input value={client.company} onChange={(event) => onChange({ ...client, company: event.target.value })} placeholder="Opcional" /></label><label className="field-stack"><span>E-mail</span><input type="email" value={client.email} onChange={(event) => onChange({ ...client, email: event.target.value })} placeholder="cliente@email.com" /></label><label className="field-stack field-span"><span>Telefone</span><input inputMode="tel" value={client.phone} onChange={(event) => onChange({ ...client, phone: formatUsPhone(event.target.value) })} placeholder="(000) 000-0000" /></label><label className="field-stack field-span"><span>Endereço</span><input value={client.address} onChange={(event) => onChange({ ...client, address: event.target.value })} placeholder="Endereço completo" /></label><label className="field-stack field-span"><span>Notas internas</span><textarea value={client.notes} onChange={(event) => onChange({ ...client, notes: event.target.value })} placeholder="Preferências, histórico, instruções…" /></label></div><div className="dialog-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancelar</button><button type="button" className="button button-primary" onClick={() => void onSave(client)}>Salvar todas as alterações</button></div></Modal>;
}

function CatalogItemDialog({ item, onChange, onClose, onSave, onDelete }: { item: CatalogItem; onChange: (item: CatalogItem) => void; onClose: () => void; onSave: (item: CatalogItem) => Promise<void>; onDelete: (item: CatalogItem) => Promise<void> }) {
  return <Modal title={item.id.startsWith("catalog-") ? "Editar item do catálogo" : "Novo item do catálogo"} onClose={onClose}><div className="dialog-form catalog-item-form"><label className="field-stack field-span"><span>Nome do item</span><input value={item.name} onChange={(event) => onChange({ ...item, name: event.target.value })} placeholder="Ex.: Peça usinada, hora técnica ou envio" /></label><label className="field-stack field-span"><span>Descrição</span><textarea value={item.description} onChange={(event) => onChange({ ...item, description: event.target.value })} placeholder="Descrição que poderá ser ajustada no documento." /></label><label className="field-stack"><span>Preço unitário</span><input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(event) => onChange({ ...item, unitPrice: Number(event.target.value) })} /></label><label className="field-stack"><span>Tipo</span><select value={item.kind} onChange={(event) => onChange({ ...item, kind: event.target.value as CatalogItem["kind"] })}><option value="item">Item</option><option value="service">Serviço</option></select></label><label className="catalog-tax-toggle"><input type="checkbox" checked={item.taxable} onChange={(event) => onChange({ ...item, taxable: event.target.checked })} /> Aplicar tax neste item</label></div><div className="dialog-actions"><button type="button" className="button button-secondary" onClick={() => void onDelete(item)}>Excluir</button><button type="button" className="button button-secondary" onClick={onClose}>Cancelar</button><button type="button" className="button button-primary" onClick={() => void onSave(item)} disabled={!item.name.trim()}>Salvar item</button></div></Modal>}

function MaterialDialog({ material, onChange, onClose, onSave }: { material: Material; onChange: (material: Material) => void; onClose: () => void; onSave: (material: Material) => Promise<void> }) {
  const number = (key: keyof Material, value: string) => onChange({ ...material, [key]: Number(value) || 0 });
  return <Modal title={material.name ? "Editar filamento" : "Adicionar filamento"} onClose={onClose} wide><div className="dialog-form"><label className="field-stack field-span"><span>Nome do filamento *</span><input value={material.name} onChange={(event) => onChange({ ...material, name: event.target.value })} placeholder="Ex.: PA6-CF — fabricante / variante" /></label><label className="field-stack"><span>Família</span><input value={material.family ?? material.type} onChange={(event) => onChange({ ...material, family: event.target.value, type: event.target.value })} placeholder="Nylon, ASA, PETG…" /></label><label className="field-stack"><span>Fabricante</span><input value={material.manufacturer ?? ""} onChange={(event) => onChange({ ...material, manufacturer: event.target.value })} placeholder="Fabricante" /></label><label className="field-stack"><span>Variante / reforço</span><input value={material.variant ?? ""} onChange={(event) => onChange({ ...material, variant: event.target.value })} placeholder="Variante" /></label><label className="field-stack"><span>Reforço</span><input value={material.reinforcement ?? ""} onChange={(event) => onChange({ ...material, reinforcement: event.target.value })} placeholder="CF, GF ou nenhum" /></label><label className="field-stack"><span>Quantidade disponível (g)</span><input type="number" min="0" value={material.availableGrams} onChange={(event) => number("availableGrams", event.target.value)} /></label><label className="field-stack"><span>Limite reposição (g)</span><input type="number" min="0" value={material.reorderAtGrams} onChange={(event) => number("reorderAtGrams", event.target.value)} /></label><label className="field-stack"><span>Valor por grama (US$)</span><input type="number" min="0" step="0.001" value={material.pricePerGram} onChange={(event) => number("pricePerGram", event.target.value)} /></label><label className="field-stack"><span>Tensão XY / Z (MPa)</span><input placeholder="55 / 32" value={`${material.tensileStrengthXY ?? ""} / ${material.tensileStrengthZ ?? ""}`} onChange={(event) => { const [xy, z] = event.target.value.split("/"); onChange({ ...material, tensileStrengthXY: Number(xy) || 0, tensileStrengthZ: Number(z) || 0 }); }} /></label><label className="field-stack"><span>Módulo de Young (MPa)</span><input type="number" value={material.youngModulus ?? ""} onChange={(event) => number("youngModulus", event.target.value)} /></label><label className="field-stack"><span>HDT @ 0.45 MPa (°C)</span><input type="number" value={material.hdt045 ?? ""} onChange={(event) => number("hdt045", event.target.value)} /></label><label className="field-stack"><span>Serviço contínuo / pico (°C)</span><input placeholder="85 / 105" value={`${material.continuousServiceTemp ?? ""} / ${material.peakServiceTemp ?? ""}`} onChange={(event) => { const [continuous, peak] = event.target.value.split("/"); onChange({ ...material, continuousServiceTemp: Number(continuous) || 0, peakServiceTemp: Number(peak) || 0 }); }} /></label><label className="field-stack"><span>UV / combustível (1–10)</span><input placeholder="9 / 5" value={`${material.uvResistance ?? ""} / ${material.gasolineResistance ?? ""}`} onChange={(event) => { const [uv, fuel] = event.target.value.split("/"); onChange({ ...material, uvResistance: Number(uv) || 0, gasolineResistance: Number(fuel) || 0 }); }} /></label><label className="field-stack"><span>Nozzle mínimo / máximo (°C)</span><input placeholder="240 / 270" value={`${material.nozzleMinTemp ?? ""} / ${material.nozzleMaxTemp ?? ""}`} onChange={(event) => { const [min, max] = event.target.value.split("/"); onChange({ ...material, nozzleMinTemp: Number(min) || 0, nozzleMaxTemp: Number(max) || 0, nozzleTemp: event.target.value }); }} /></label><label className="field-stack"><span>Secagem °C / horas</span><input placeholder="70 / 6" value={`${material.dryingTemperature ?? ""} / ${material.dryingTimeHours ?? ""}`} onChange={(event) => { const [temperature, hours] = event.target.value.split("/"); onChange({ ...material, dryingTemperature: Number(temperature) || 0, dryingTimeHours: Number(hours) || 0 }); }} /></label><label className="field-stack"><span>Nível de confiança</span><select value={material.confidenceLevel ?? "Média"} onChange={(event) => onChange({ ...material, confidenceLevel: event.target.value as Material["confidenceLevel"] })}><option>Baixa</option><option>Média</option><option>Alta</option></select></label><label className="field-stack field-span"><span>Fonte de dados</span><input value={material.dataSource ?? ""} onChange={(event) => onChange({ ...material, dataSource: event.target.value })} placeholder="Fabricante, ensaio interno, catálogo…" /></label><label className="field-stack field-span"><span>Datasheet / URL</span><input type="url" value={material.datasheetUrl ?? ""} onChange={(event) => onChange({ ...material, datasheetUrl: event.target.value })} placeholder="https://…" /></label><label className="field-stack"><span>Norma de ensaio</span><input value={material.testStandard ?? ""} onChange={(event) => onChange({ ...material, testStandard: event.target.value })} placeholder="ASTM D648, ISO…" /></label><label className="field-stack"><span>Última atualização</span><input type="date" value={material.lastUpdated ?? ""} onChange={(event) => onChange({ ...material, lastUpdated: event.target.value })} /></label><label className="field-stack field-span"><span>Notas técnicas / impressão</span><textarea value={material.technicalNotes ?? material.printNotes} onChange={(event) => onChange({ ...material, technicalNotes: event.target.value, printNotes: event.target.value })} placeholder="Condições, limitações, secagem, orientação…" /></label></div><div className="dialog-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancelar</button><button type="button" className="button button-primary" onClick={() => void onSave(material)}>Salvar filamento técnico</button></div></Modal>;
}

function CalendarDialog({ event, onChange, onClose, onSave }: { event: CalendarEvent; onChange: (event: CalendarEvent) => void; onClose: () => void; onSave: (event: CalendarEvent) => Promise<void> }) {
  return <Modal title="Novo evento" onClose={onClose}><div className="dialog-form"><label className="field-stack field-span"><span>Título *</span><input value={event.title} onChange={(change) => onChange({ ...event, title: change.target.value })} placeholder="Ex.: Visita técnica" /></label><label className="field-stack"><span>Data e hora *</span><input type="datetime-local" value={event.date.slice(0, 16)} onChange={(change) => onChange({ ...event, date: new Date(change.target.value).toISOString() })} /></label><label className="field-stack"><span>Categoria</span><select value={event.type} onChange={(change) => onChange({ ...event, type: change.target.value as CalendarEvent["type"] })}><option value="calendar">Agenda</option><option value="order">Pedido</option><option value="triage">Triagem</option><option value="inventory">Estoque</option><option value="maintenance">Manutenção</option></select></label><label className="field-stack field-span"><span>Detalhes</span><textarea value={event.detail} onChange={(change) => onChange({ ...event, detail: change.target.value })} placeholder="O que precisa ficar visível no histórico?" /></label></div><div className="dialog-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancelar</button><button type="button" className="button button-primary" onClick={() => void onSave(event)}>Salvar evento</button></div></Modal>;
}

function PrinterDialog({ printer, onChange, onClose, onSave }: { printer: PrinterModel; onChange: (printer: PrinterModel) => void; onClose: () => void; onSave: (printer: PrinterModel) => Promise<void> }) {
  const number = (key: keyof PrinterModel, value: string) => onChange({ ...printer, [key]: Number(value) || 0 });
  return <Modal title={printer.name ? "Editar impressora" : "Nova impressora"} onClose={onClose}><div className="dialog-form"><label className="field-stack"><span>Nome *</span><input value={printer.name} onChange={(event) => onChange({ ...printer, name: event.target.value })} placeholder="Ex.: Bambu Lab X2D" /></label><label className="field-stack"><span>Modelo *</span><input value={printer.model} onChange={(event) => onChange({ ...printer, model: event.target.value })} placeholder="Modelo / configuração" /></label><label className="field-stack"><span>Status</span><select value={printer.status} onChange={(event) => onChange({ ...printer, status: event.target.value as PrinterModel["status"] })}><option>Pronta</option><option>Em manutenção</option><option>Indisponível</option></select></label><label className="field-stack"><span>Material atual</span><input value={printer.material} onChange={(event) => onChange({ ...printer, material: event.target.value })} placeholder="PLA / PETG" /></label><label className="field-stack"><span>Nozzle máximo (°C)</span><input type="number" value={printer.maxNozzleTemp ?? ""} onChange={(event) => number("maxNozzleTemp", event.target.value)} /></label><label className="field-stack"><span>Mesa máxima (°C)</span><input type="number" value={printer.maxBedTemp ?? ""} onChange={(event) => number("maxBedTemp", event.target.value)} /></label><label className="field-stack"><span>Câmara máxima (°C)</span><input type="number" value={printer.maxChamberTemp ?? ""} onChange={(event) => number("maxChamberTemp", event.target.value)} /></label><label className="field-stack"><span>Diâmetro do nozzle (mm)</span><input type="number" step="0.1" value={printer.nozzleDiameter ?? ""} onChange={(event) => number("nozzleDiameter", event.target.value)} /></label><label className="field-stack field-span"><span>Volume útil X × Y × Z (mm)</span><input value={printer.buildVolume ?? ""} onChange={(event) => onChange({ ...printer, buildVolume: event.target.value })} placeholder="256 × 256 × 256" /></label><label className="field-stack field-span"><span>Materiais compatíveis</span><input value={(printer.compatibleMaterials ?? []).join(", ")} onChange={(event) => onChange({ ...printer, compatibleMaterials: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} placeholder="PLA, PETG, ASA, PA6-CF" /></label><label className="selector-check"><input type="checkbox" checked={Boolean(printer.hardenedNozzle)} onChange={(event) => onChange({ ...printer, hardenedNozzle: event.target.checked })} /> Bico endurecido disponível</label><label className="selector-check"><input type="checkbox" checked={Boolean(printer.dryingAvailable)} onChange={(event) => onChange({ ...printer, dryingAvailable: event.target.checked })} /> Secagem controlada disponível</label></div><div className="dialog-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancelar</button><button type="button" className="button button-primary" onClick={() => void onSave(printer)}>Salvar perfil técnico</button></div></Modal>;
}

function MaintenanceDialog({ printer, onClose, onSave }: { printer: PrinterModel; onClose: () => void; onSave: (printer: PrinterModel, entry: MaintenanceEntry) => Promise<void> }) {
  const [entry, setEntry] = useState<MaintenanceEntry>({ id: id("maintenance"), date: todayInputValue(), title: "", notes: "", status: "Concluída" });
  return <Modal title={`Manutenção · ${printer.name}`} onClose={onClose}><div className="maintenance-dialog"><div className="maintenance-history"><p className="eyebrow">Histórico da impressora</p>{printer.maintenance?.length ? printer.maintenance.map((item) => <div className="maintenance-history-row" key={item.id}><Wrench size={16} /><div><b>{item.title}</b><p>{item.notes || "Sem observações"}</p></div><time>{item.date}</time></div>) : <p className="muted-copy">Nenhuma intervenção registrada para esta impressora.</p>}</div><div className="dialog-form"><label className="field-stack field-span"><span>Atividade *</span><input value={entry.title} onChange={(change) => setEntry({ ...entry, title: change.target.value })} placeholder="Ex.: Limpeza de bico e lubrificação" /></label><label className="field-stack"><span>Data</span><input type="date" value={entry.date} onChange={(change) => setEntry({ ...entry, date: change.target.value })} /></label><label className="field-stack"><span>Situação</span><select value={entry.status} onChange={(change) => setEntry({ ...entry, status: change.target.value as MaintenanceEntry["status"] })}><option>Concluída</option><option>Agendada</option></select></label><label className="field-stack field-span"><span>Notas</span><textarea value={entry.notes} onChange={(change) => setEntry({ ...entry, notes: change.target.value })} placeholder="Peças substituídas, ciclo de limpeza, próxima revisão…" /></label></div></div><div className="dialog-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancelar</button><button type="button" className="button button-primary" onClick={() => { if (!entry.title.trim()) return; void onSave(printer, entry); }}>Registrar manutenção</button></div></Modal>;
}

function OrderDialog({ order, clients, materials, onChange, onClose, onSave, createLine }: { order: Order; clients: Client[]; materials: Material[]; onChange: (order: Order) => void; onClose: () => void; onSave: (order: Order) => Promise<void>; createLine: (service: OrderLine["service"], material: Material) => OrderLine }) {
  const material = materials.find((item) => item.id === order.materialId) ?? materials[0];
  const totals = calculateOrderTotals(order.lines, order.taxRate ?? 0);
  const total = centsToAmount(totals.totalCents);
  const addLine = (service: OrderLine["service"]) => onChange({ ...order, lines: [...order.lines, createLine(service, material)] });
  const updateLine = (lineId: string, patch: Partial<OrderLine>) => onChange({ ...order, lines: order.lines.map((line) => line.id === lineId ? { ...line, ...patch } : line) });
  return <Modal title="Novo documento" onClose={onClose} wide><div className="order-dialog"><div className="order-type-toggle"><button type="button" className={order.documentType === "Orçamento" ? "selected" : ""} onClick={() => onChange({ ...order, documentType: "Orçamento" })}><FileText size={17} /> Orçamento</button><button type="button" className={order.documentType === "Invoice" ? "selected" : ""} onClick={() => onChange({ ...order, documentType: "Invoice" })}><CircleDollarSign size={17} /> Invoice</button></div><div className="document-grid"><section className="document-section"><div className="section-caption"><UsersRound size={17} /><span>Cliente e datas</span></div><div className="dialog-form"><label className="field-stack field-span"><span>Cliente *</span><input list="client-suggestions" value={clients.find((client) => client.id === order.clientId)?.name ?? ""} placeholder="Digite 4 caracteres para sugerir" onChange={(event) => { const value = event.target.value; const selected = clients.find((client) => client.name.toLocaleLowerCase() === value.toLocaleLowerCase() || client.email.toLocaleLowerCase() === value.toLocaleLowerCase()); onChange({ ...order, clientId: selected?.id ?? "", clientName: selected?.name ?? value }); }} /><datalist id="client-suggestions">{clients.filter((client) => clients.length < 1 || client.name.length >= 1).map((client) => <option key={client.id} value={client.name}>{client.email}</option>)}</datalist>{!clients.length && <small className="inline-warning">Cadastre um cliente antes de salvar o documento.</small>}</label><label className="field-stack"><span>Início</span><input type="date" value={order.startDate} onChange={(event) => onChange({ ...order, startDate: event.target.value })} /></label><label className="field-stack"><span>Entrega</span><input type="date" value={order.dueDate} onChange={(event) => onChange({ ...order, dueDate: event.target.value })} /></label></div></section><section className="document-section"><div className="section-caption"><Box size={17} /><span>Item e material</span></div><div className="dialog-form"><label className="field-stack field-span"><span>Item a desenvolver *</span><input value={order.title} onChange={(event) => onChange({ ...order, title: event.target.value })} placeholder="Ex.: acabamento para painel de porta" /></label><label className="field-stack field-span"><span>Material</span><select value={order.materialId} onChange={(event) => { const selected = materials.find((item) => item.id === event.target.value)!; onChange({ ...order, materialId: selected.id, materialName: selected.name }); }}>{materials.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="field-stack"><span>Material previsto (g)</span><input type="number" min="0" value={order.materialGrams || ""} onChange={(event) => onChange({ ...order, materialGrams: Number(event.target.value) })} placeholder="0" /></label></div>{material && <div className="material-info"><div><span className="material-swatch" style={{ background: material.color.toLowerCase() === "natural" ? "#dccaa5" : material.color.toLowerCase() }} /><b>{material.name}</b><small>{material.availableGrams} g em estoque · limite {material.reorderAtGrams} g</small></div><div><span>Bico</span><b>{material.nozzleTemp || "—"}</b></div><div><span>Mesa</span><b>{material.bedTemp || "—"}</b></div><p>{material.printNotes || "Sem observação técnica registrada."}</p></div>}</section></div><section className="document-section services-section"><div className="section-caption"><HardHat size={17} /><span>Composição do documento</span><small>Adicione somente o que se aplica ao processo.</small></div><div className="service-picker">{(["scan", "cad", "print", "post", "hardware", "shipping"] as OrderLine["service"][]).map((service) => <button type="button" key={service} onClick={() => addLine(service)}><Plus size={14} /> {serviceLabels[service]}</button>)}</div><div className="line-items">{order.lines.map((line) => <div className="line-item" key={line.id}><strong>{line.label}</strong><input aria-label={`${line.label} descrição`} value={line.description} onChange={(event) => updateLine(line.id, { description: event.target.value })} placeholder="Descrição" /><label>Qtd.<input type="number" min="0" step="0.25" value={line.quantity} onChange={(event) => updateLine(line.id, { quantity: Number(event.target.value) })} /></label><label>Valor unitário<input type="number" min="0" step="0.01" value={line.unitPrice} onChange={(event) => updateLine(line.id, { unitPrice: Number(event.target.value) })} /></label><b>{currency(line.quantity * line.unitPrice)}</b><button type="button" aria-label={`Remover ${line.label}`} className="icon-button" onClick={() => onChange({ ...order, lines: order.lines.filter((item) => item.id !== line.id) })}><X size={16} /></button></div>)}{!order.lines.length && <p className="muted-copy">Selecione os serviços acima para compor preço por hora, máquina, material, pós-processamento, hardware ou envio.</p>}</div></section><label className="field-stack"><span>Notas para o documento</span><textarea value={order.notes} onChange={(event) => onChange({ ...order, notes: event.target.value })} placeholder="Observações, condições, detalhes de engenharia ou de entrega…" /></label><div className="document-notes-grid"><label className="field-stack"><span>Nota pública · aparece no PDF</span><textarea value={order.publicNote ?? ""} onChange={(event) => onChange({ ...order, publicNote: event.target.value })} placeholder="Condições, prazo e observações para o cliente…" /></label><label className="field-stack"><span>Nota privada · apenas autenticados</span><textarea value={order.privateNote ?? ""} onChange={(event) => onChange({ ...order, privateNote: event.target.value })} placeholder="Registro interno, premissas ou pendências…" /></label></div><div className="payment-strip"><div><span className="eyebrow">Pagamentos</span><small>Valores em centavos no armazenamento; serviços nunca recebem tax.</small></div><strong>{currency((order.payments ?? []).reduce((sum, payment) => sum + payment.amount, 0))} recebido</strong><button type="button" className="button button-secondary" onClick={() => onChange({ ...order, payments: [...(order.payments ?? []), { id: id("payment"), method: "Pix", amount: 0, date: todayInputValue() } as Payment] })}><Plus size={14} /> Adicionar</button></div>{(order.payments ?? []).map((payment) => <div className="payment-row" key={payment.id}><input aria-label="Método de pagamento" value={payment.method} onChange={(event) => onChange({ ...order, payments: order.payments?.map((item) => item.id === payment.id ? { ...item, method: event.target.value } : item) })} /><input aria-label="Valor do pagamento" type="number" min="0" step="0.01" value={payment.amount || ""} onChange={(event) => onChange({ ...order, payments: order.payments?.map((item) => item.id === payment.id ? { ...item, amount: Number(event.target.value) } : item) })} /><input aria-label="Data do pagamento" type="date" value={payment.date} onChange={(event) => onChange({ ...order, payments: order.payments?.map((item) => item.id === payment.id ? { ...item, date: event.target.value } : item) })} /></div>)}<div className="document-total"><span>Total estimado</span><strong>{currency(total)}</strong></div></div><div className="dialog-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancelar</button><button type="button" className="button button-primary" onClick={() => void onSave({ ...order, total })}>Salvar {order.documentType}</button></div></Modal>;
}
