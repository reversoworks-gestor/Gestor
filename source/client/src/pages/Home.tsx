import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import {
  addDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
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
  Pencil,
  Plus,
  Printer,
  ScanLine,
  Settings2,
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
  workspaceCollection,
} from "@/lib/firebase";
import { currency, dateTimeLabel, dayLabel, displayName, formatUsPhone } from "@/lib/formatters";
import { calculateOrderTotals, centsToAmount, printServicePrice } from "@/lib/finance";
import type {
  CalendarEvent,
  Client,
  MaintenanceEntry,
  Material,
  Order,
  OrderLine,
  Printer as PrinterModel,
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
  },
];

const serviceLabels: Record<OrderLine["service"], string> = {
  scan: "Escaneamento 3D",
  cad: "CAD / modelagem",
  print: "Impressão 3D",
  post: "Pós-processamento",
  hardware: "Hardware / componentes",
  shipping: "Envio",
};

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

function orderTemplate(material: Material): Order {
  return {
    id: id("order"),
    documentType: "Orçamento",
    status: "Rascunho",
    clientId: "",
    clientName: "",
    title: "",
    dueDate: "",
    startDate: todayInputValue(),
    materialId: material.id,
    materialName: material.name,
    materialGrams: 0,
    notes: "",
    lines: [],
    total: 0,
    createdAt: nowIso(),
  };
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
    const validViews: ViewId[] = ["overview", "orders", "triage", "clients", "calendar", "inventory", "printers", "settings"];
    return preview && validViews.includes(requested) ? requested : "overview";
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [triages, setTriages] = useState<Triage[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [printers, setPrinters] = useState<PrinterModel[]>([]);
  const [clientModal, setClientModal] = useState<Client | null>(null);
  const [materialModal, setMaterialModal] = useState<Material | null>(null);
  const [calendarModal, setCalendarModal] = useState<CalendarEvent | null>(null);
  const [maintenancePrinter, setMaintenancePrinter] = useState<PrinterModel | null>(null);
  const [orderModal, setOrderModal] = useState<Order | null>(null);
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

  const activeMaterials = materials.length ? materials : defaultMaterials;
  const activePrinters = printers.length ? printers : defaultPrinters;
  const userName = displayName(user?.email);

  useEffect(() => {
    if (!user || preview) return;
    const subscriptions = [
      ["clients", setClients],
      ["materials", setMaterials],
      ["orders", setOrders],
      ["triages", setTriages],
      ["calendar", setEvents],
      ["printers", setPrinters],
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

  const schedule = useMemo(
    () => [...events].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [events],
  );
  const lowStock = activeMaterials.filter((material) => material.availableGrams <= material.reorderAtGrams);
  const outstanding = orders
    .filter((order) => order.status !== "Aprovado" && order.status !== "Em produção")
    .reduce((sum, order) => sum + Number(order.total || 0), 0);

  useEffect(() => {
    if (!preview) return;
    setMaterials((current) => current.length ? current : defaultMaterials);
    setPrinters((current) => current.length ? current : defaultPrinters);
  }, [preview]);

  async function saveRecord(collectionName: string, record: { id: string; [key: string]: unknown }) {
    if (preview) return;
    const { id: recordId, ...data } = record;
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
    const saved = { ...client, phone: formatUsPhone(client.phone), updatedAt: nowIso() };
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
      label: serviceLabels[service],
      quantity: 1,
      unitPrice: 0,
      description: "",
    };
    if (service === "scan") return { ...basic, quantity: 1, unitPrice: 85, description: "1 hora de escaneamento" };
    if (service === "cad") return { ...basic, quantity: 1, unitPrice: 75, description: "1 hora de CAD" };
    if (service === "print") return { ...basic, quantity: 1, unitPrice: centsToAmount(printServicePrice({ pricePerGram: material.pricePerGram, weightGrams: 100, hours: 1 })), description: "1 h de máquina + 100 g de material" };
    if (service === "post") return { ...basic, quantity: 1, unitPrice: 45, description: "Acabamento e preparação" };
    if (service === "hardware") return { ...basic, quantity: 1, unitPrice: 0, description: "Componentes aplicados no preenchimento" };
    return { ...basic, quantity: 1, unitPrice: 0, description: "Frete definido no preenchimento" };
  }

  async function saveOrder(order: Order) {
    if (!order.clientId || !order.title.trim()) {
      setNotice("Selecione o cliente e descreva o item para salvar o documento.");
      return;
    }
    const material = activeMaterials.find((item) => item.id === order.materialId) ?? activeMaterials[0];
    const client = clients.find((item) => item.id === order.clientId);
    const totals = calculateOrderTotals(order.lines, order.taxRate ?? 0);
    const total = centsToAmount(totals.totalCents);
    const saved: Order = {
      ...order,
      clientName: client?.name ?? order.clientName,
      materialName: material.name,
      subtotal: centsToAmount(totals.subtotalCents),
      tax: centsToAmount(totals.taxCents),
      total,
      createdAt: order.createdAt || nowIso(),
    };
    try {
      if (preview) setOrders((current) => [saved, ...current]);
      else {
        if (!materials.some((item) => item.id === material.id)) await saveRecord("materials", material);
        await saveRecord("orders", saved);
        if (saved.materialGrams > 0) {
          await updateDoc(doc(db, "workspaces", "reverso-private", "materials", material.id), {
            availableGrams: Math.max(0, material.availableGrams - saved.materialGrams),
            updatedAt: serverTimestamp(),
          });
        }
      }
      await recordProcess(
        "order",
        `${saved.documentType} criado: ${saved.title}`,
        `${saved.clientName} · ${currency(total)} · ${saved.materialGrams || 0} g de ${material.name}.`,
      );
      if (saved.materialGrams > 0) {
        await recordProcess("inventory", `Consumo reservado: ${material.name}`, `${saved.materialGrams} g alocados ao documento ${saved.title}.`);
      }
      setOrderModal(null);
      setNotice(`${saved.documentType} salvo; consumo e processo registrados visualmente no calendário.`);
    } catch {
      setNotice("Não foi possível salvar o documento. Verifique o material e sua conexão.");
    }
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
    { id: "overview", label: "Visão geral", icon: Box },
    { id: "orders", label: "Pedidos", icon: FileText },
    { id: "triage", label: "Triagem técnica", icon: ClipboardCheck },
    { id: "clients", label: "Clientes", icon: UsersRound },
    { id: "calendar", label: "Calendário", icon: CalendarDays },
    { id: "inventory", label: "Estoque", icon: Layers3 },
    { id: "printers", label: "Impressoras", icon: Printer },
    { id: "settings", label: "Ajustes", icon: Settings2 },
  ];

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
          <button type="button" className="mobile-menu icon-button" aria-label="Abrir menu" onClick={() => setMobileOpen(true)}><Menu size={20} /></button>
          <div className="topbar-title"><span>REVERSE ENGINEERING / 01</span><b>{navigation.find((item) => item.id === view)?.label}</b></div>
          <div className="topbar-actions">
            <button type="button" className="button button-quiet" onClick={() => navigate("calendar")}><CalendarDays size={17} /><span>Calendário</span></button>
            <button type="button" className="button button-primary" onClick={() => setOrderModal(orderTemplate(activeMaterials[0]))}><Plus size={18} /> Novo pedido</button>
          </div>
        </header>

        {view === "overview" && (
          <section className="view overview-view">
            <SectionHeader
              eyebrow={`Olá, ${userName}`}
              title="Controle a operação sem perder o ritmo."
              description="Pedidos, produção e memória técnica conectados em um único espaço de trabalho."
              action={<button type="button" className="button button-primary" onClick={() => setOrderModal(orderTemplate(activeMaterials[0]))}><FilePlus2 size={18} /> Novo documento</button>}
            />
            <div className="hero-grid">
              <article className="command-card">
                <div className="command-card-copy">
                  <span className="signal"><Sparkles size={14} /> Centro de comando</span>
                  <h2>Da referência física à peça possível.</h2>
                  <p>Inicie um documento, registre uma triagem ou acompanhe o que a operação pede hoje.</p>
                  <div className="command-actions">
                    <button type="button" className="button button-primary" onClick={() => setOrderModal(orderTemplate(activeMaterials[0]))}>Criar pedido <ChevronRight size={16} /></button>
                    <button type="button" className="button button-secondary" onClick={() => navigate("triage")}><ClipboardCheck size={16} /> Executar triagem</button>
                  </div>
                </div>
                <div className="command-orbit"><div className="orbit-core"><ScanLine size={29} /><span>ENG</span></div></div>
              </article>
              <article className="triage-shortcut">
                <div className="shortcut-icon"><ClipboardCheck size={22} /></div>
                <p className="eyebrow">Acesso rápido</p>
                <h3>Triagem técnica</h3>
                <p>Decida viabilidade, material e prioridade antes de abrir a fila.</p>
                <button type="button" className="inline-action" onClick={() => navigate("triage")}>Abrir triagem <ChevronRight size={16} /></button>
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
              <button type="button" onClick={() => navigate("inventory")}><PackageOpen size={18} /><span>Estoque</span><small>{activeMaterials.length} materiais</small></button>
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
            <SectionHeader eyebrow="Decisão técnica" title="Triagem técnica" description="Faça uma leitura objetiva da peça antes de comprometer horas de engenharia ou material." />
            <div className="triage-layout">
              <article className="panel-card triage-form-card">
                <div className="panel-title"><div><p className="eyebrow">Nova análise</p><h3>Executar triagem</h3></div><span className="score-pill">Pré-produção</span></div>
                <div className="form-grid">
                  <TriageField label="Peça ou referência" required error={triageErrors.includes("piece")}><input value={triageForm.piece} onChange={(event) => setTriageForm({ ...triageForm, piece: event.target.value })} placeholder="Ex.: suporte de painel" /></TriageField>
                  <TriageField label="Objetivo" required error={triageErrors.includes("objective")}><input value={triageForm.objective} onChange={(event) => setTriageForm({ ...triageForm, objective: event.target.value })} placeholder="Repor, adaptar, prototipar…" /></TriageField>
                  <TriageField label="Material provável" required error={triageErrors.includes("material")}><select value={triageForm.material} onChange={(event) => setTriageForm({ ...triageForm, material: event.target.value })}><option value="">Selecionar material</option>{activeMaterials.map((material) => <option key={material.id} value={material.name}>{material.name}</option>)}</select></TriageField>
                  <TriageField label="Complexidade" required error={triageErrors.includes("complexity")}><select value={triageForm.complexity} onChange={(event) => setTriageForm({ ...triageForm, complexity: event.target.value })}><option value="">Selecionar</option><option>Baixa</option><option>Média</option><option>Alta</option><option>Crítica</option></select></TriageField>
                  <TriageField label="Urgência" required error={triageErrors.includes("urgency")}><select value={triageForm.urgency} onChange={(event) => setTriageForm({ ...triageForm, urgency: event.target.value })}><option value="">Selecionar</option><option>Baixa</option><option>Média</option><option>Alta</option><option>Crítica</option></select></TriageField>
                  <TriageField label="Notas técnicas"><textarea value={triageForm.notes} onChange={(event) => setTriageForm({ ...triageForm, notes: event.target.value })} placeholder="Riscos, medidas disponíveis, acabamento desejado…" /></TriageField>
                </div>
                <button type="button" className="button button-primary triage-submit" onClick={() => void saveTriage()}><ClipboardCheck size={18} /> Executar triagem</button>
              </article>
              <article className="panel-card triage-history"><p className="eyebrow">Memória técnica</p><h3>Triagens recentes</h3>{triages.length ? <div className="stack-list">{triages.slice(0, 6).map((triage) => <div key={triage.id} className="triage-row"><div><b>{triage.piece}</b><p>{triage.objective}</p></div><span>{triage.score}/8</span></div>)}</div> : <p className="muted-copy">As análises salvas serão mantidas aqui e também registradas no calendário.</p>}</article>
            </div>
          </section>
        )}

        {view === "orders" && (
          <section className="view">
            <SectionHeader eyebrow="Comercial e produção" title="Pedidos, orçamentos e invoices" description="Cada documento conecta cliente, escopo, material, datas e custo técnico." action={<button type="button" className="button button-primary" onClick={() => setOrderModal(orderTemplate(activeMaterials[0]))}><Plus size={17} /> Novo documento</button>} />
            <div className="order-list">
              {orders.map((order) => <article className="order-card" key={order.id}><div className="order-symbol">{order.documentType === "Invoice" ? <CircleDollarSign size={21} /> : <FileText size={21} />}</div><div className="order-main"><div className="order-title"><span>{order.documentType}</span><h3>{order.title}</h3></div><p>{order.clientName} · {order.materialName || "Material não definido"}</p><small><Clock3 size={13} /> Entrega: {order.dueDate || "a definir"}</small></div><div className="order-value"><strong>{currency(order.total)}</strong><span>{order.status}</span></div></article>)}
              {!orders.length && <EmptyState icon={FilePlus2} title="Nenhum documento criado" body="Crie um orçamento ou invoice com serviços, material, datas e notas do processo." action={<button type="button" className="button button-primary" onClick={() => setOrderModal(orderTemplate(activeMaterials[0]))}>Criar documento</button>} />}
            </div>
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
            <SectionHeader eyebrow="Fábrica" title="Gerenciamento de manutenção" description="Cada impressora tem histórico próprio e as intervenções ficam visíveis na operação." />
            <div className="printer-grid">{activePrinters.map((printer) => <article className="printer-card" key={printer.id}><div className="printer-top"><div className="printer-icon"><Printer size={26} /></div><div><p className="eyebrow">{printer.model}</p><h3>{printer.name}</h3></div><span className={printer.status === "Pronta" ? "status-ready" : "status-alert"}>{printer.status}</span></div><div className="printer-facts"><div><span>Material atual</span><b>{printer.material || "Não definido"}</b></div><div><span>Última manutenção</span><b>{printer.lastMaintenance || "Não registrada"}</b></div></div><div className="maintenance-preview">{printer.maintenance?.length ? printer.maintenance.slice(0, 2).map((entry) => <p key={entry.id}><Wrench size={14} /> {entry.title} <time>{entry.date}</time></p>) : <p><Cog size={14} /> Nenhuma manutenção registrada.</p>}</div><button type="button" className="button button-secondary full-width" onClick={() => setMaintenancePrinter(printer)}><Wrench size={17} /> Gerenciar manutenção</button></article>)}</div>
          </section>
        )}

        {view === "settings" && (
          <section className="view">
            <SectionHeader eyebrow="Acesso privado" title="Equipe e configuração" description="Somente e-mails autorizados podem abrir os dados operacionais deste espaço." />
            <div className="settings-grid"><article className="panel-card"><p className="eyebrow">Equipe do espaço</p><h3>Autorizar integrante</h3><p className="muted-copy">A conta atual é exibida com nome personalizado: Lincoln para Lincoln e Duda para Eduarda.</p><div className="team-member"><span>{userName.slice(0, 1).toUpperCase()}</span><div><b>{userName}</b><p>{user?.email || "Prévia da interface"}</p></div><em>Ativo</em></div>{!preview && <div className="team-form"><input type="email" value={teamEmail} onChange={(event) => setTeamEmail(event.target.value)} placeholder="E-mail da integrante" /><button type="button" className="button button-primary" onClick={() => void authorizeTeamMember()}>Autorizar acesso</button></div>}</article><article className="panel-card"><p className="eyebrow">Princípios de operação</p><h3>Registros rastreáveis</h3><ul className="settings-list"><li><Check size={16} /> Telefone formatado em padrão americano</li><li><Check size={16} /> Toda etapa relevante cria um evento visual</li><li><Check size={16} /> Consumo do material é abatido ao salvar o documento</li></ul></article></div>
          </section>
        )}
      </main>

      <nav className="mobile-nav" aria-label="Navegação móvel">{navigation.slice(0, 5).map(({ id: navId, label, icon: Icon }) => <button key={navId} className={view === navId ? "mobile-active" : ""} type="button" onClick={() => navigate(navId)}><Icon size={19} /><span>{label === "Visão geral" ? "Início" : label.replace(" técnica", "")}</span></button>)}</nav>

      {clientModal && <ClientDialog client={clientModal} onChange={setClientModal} onClose={() => setClientModal(null)} onSave={saveClient} />}
      {materialModal && <MaterialDialog material={materialModal} onChange={setMaterialModal} onClose={() => setMaterialModal(null)} onSave={saveMaterial} />}
      {calendarModal && <CalendarDialog event={calendarModal} onChange={setCalendarModal} onClose={() => setCalendarModal(null)} onSave={saveCalendarEvent} />}
      {maintenancePrinter && <MaintenanceDialog printer={maintenancePrinter} onClose={() => setMaintenancePrinter(null)} onSave={saveMaintenance} />}
      {orderModal && <OrderDialog order={orderModal} clients={clients} materials={activeMaterials} onChange={setOrderModal} onClose={() => setOrderModal(null)} onSave={saveOrder} createLine={createLine} />}
    </div>
  );
}

function ClientDialog({ client, onChange, onClose, onSave }: { client: Client; onChange: (client: Client) => void; onClose: () => void; onSave: (client: Client) => Promise<void> }) {
  return <Modal title={client.name ? "Editar cliente" : "Novo cliente"} onClose={onClose}><div className="dialog-form"><label className="field-stack field-span"><span>Nome completo *</span><input value={client.name} onChange={(event) => onChange({ ...client, name: event.target.value })} placeholder="Nome do cliente" /></label><label className="field-stack"><span>Empresa</span><input value={client.company} onChange={(event) => onChange({ ...client, company: event.target.value })} placeholder="Opcional" /></label><label className="field-stack"><span>E-mail</span><input type="email" value={client.email} onChange={(event) => onChange({ ...client, email: event.target.value })} placeholder="cliente@email.com" /></label><label className="field-stack"><span>Telefone</span><input inputMode="tel" value={client.phone} onChange={(event) => onChange({ ...client, phone: formatUsPhone(event.target.value) })} placeholder="(000) 000-0000" /></label><label className="field-stack field-span"><span>Endereço</span><input value={client.address} onChange={(event) => onChange({ ...client, address: event.target.value })} placeholder="Endereço completo" /></label><label className="field-stack field-span"><span>Notas internas</span><textarea value={client.notes} onChange={(event) => onChange({ ...client, notes: event.target.value })} placeholder="Preferências, histórico, instruções…" /></label></div><div className="dialog-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancelar</button><button type="button" className="button button-primary" onClick={() => void onSave(client)}>Salvar todas as alterações</button></div></Modal>;
}

function MaterialDialog({ material, onChange, onClose, onSave }: { material: Material; onChange: (material: Material) => void; onClose: () => void; onSave: (material: Material) => Promise<void> }) {
  return <Modal title={material.name ? "Editar filamento" : "Adicionar filamento"} onClose={onClose}><div className="dialog-form"><label className="field-stack field-span"><span>Nome do filamento *</span><input value={material.name} onChange={(event) => onChange({ ...material, name: event.target.value })} placeholder="Ex.: PETG transparente" /></label><label className="field-stack"><span>Tipo</span><input value={material.type} onChange={(event) => onChange({ ...material, type: event.target.value })} placeholder="PETG, ASA, TPU…" /></label><label className="field-stack"><span>Cor</span><input value={material.color} onChange={(event) => onChange({ ...material, color: event.target.value })} placeholder="Grafite" /></label><label className="field-stack"><span>Quantidade disponível (g)</span><input type="number" min="0" value={material.availableGrams} onChange={(event) => onChange({ ...material, availableGrams: Number(event.target.value) })} /></label><label className="field-stack"><span>Limite para reposição (g)</span><input type="number" min="0" value={material.reorderAtGrams} onChange={(event) => onChange({ ...material, reorderAtGrams: Number(event.target.value) })} /></label><label className="field-stack"><span>Valor por grama (US$)</span><input type="number" min="0" step="0.001" value={material.pricePerGram} onChange={(event) => onChange({ ...material, pricePerGram: Number(event.target.value) })} /></label><label className="field-stack"><span>Temperatura do bico</span><input value={material.nozzleTemp} onChange={(event) => onChange({ ...material, nozzleTemp: event.target.value })} placeholder="205–225 °C" /></label><label className="field-stack"><span>Temperatura da mesa</span><input value={material.bedTemp} onChange={(event) => onChange({ ...material, bedTemp: event.target.value })} placeholder="55–70 °C" /></label><label className="field-stack field-span"><span>Notas de impressão</span><textarea value={material.printNotes} onChange={(event) => onChange({ ...material, printNotes: event.target.value })} placeholder="Cuidados, perfil recomendado, secagem…" /></label></div><div className="dialog-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancelar</button><button type="button" className="button button-primary" onClick={() => void onSave(material)}>Salvar filamento</button></div></Modal>;
}

function CalendarDialog({ event, onChange, onClose, onSave }: { event: CalendarEvent; onChange: (event: CalendarEvent) => void; onClose: () => void; onSave: (event: CalendarEvent) => Promise<void> }) {
  return <Modal title="Novo evento" onClose={onClose}><div className="dialog-form"><label className="field-stack field-span"><span>Título *</span><input value={event.title} onChange={(change) => onChange({ ...event, title: change.target.value })} placeholder="Ex.: Visita técnica" /></label><label className="field-stack"><span>Data e hora *</span><input type="datetime-local" value={event.date.slice(0, 16)} onChange={(change) => onChange({ ...event, date: new Date(change.target.value).toISOString() })} /></label><label className="field-stack"><span>Categoria</span><select value={event.type} onChange={(change) => onChange({ ...event, type: change.target.value as CalendarEvent["type"] })}><option value="calendar">Agenda</option><option value="order">Pedido</option><option value="triage">Triagem</option><option value="inventory">Estoque</option><option value="maintenance">Manutenção</option></select></label><label className="field-stack field-span"><span>Detalhes</span><textarea value={event.detail} onChange={(change) => onChange({ ...event, detail: change.target.value })} placeholder="O que precisa ficar visível no histórico?" /></label></div><div className="dialog-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancelar</button><button type="button" className="button button-primary" onClick={() => void onSave(event)}>Salvar evento</button></div></Modal>;
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
  return <Modal title="Novo documento" onClose={onClose} wide><div className="order-dialog"><div className="order-type-toggle"><button type="button" className={order.documentType === "Orçamento" ? "selected" : ""} onClick={() => onChange({ ...order, documentType: "Orçamento" })}><FileText size={17} /> Orçamento</button><button type="button" className={order.documentType === "Invoice" ? "selected" : ""} onClick={() => onChange({ ...order, documentType: "Invoice" })}><CircleDollarSign size={17} /> Invoice</button></div><div className="document-grid"><section className="document-section"><div className="section-caption"><UsersRound size={17} /><span>Cliente e datas</span></div><div className="dialog-form"><label className="field-stack field-span"><span>Cliente *</span><select value={order.clientId} onChange={(event) => onChange({ ...order, clientId: event.target.value })}><option value="">Selecionar cliente</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select>{!clients.length && <small className="inline-warning">Cadastre um cliente antes de salvar o documento.</small>}</label><label className="field-stack"><span>Início</span><input type="date" value={order.startDate} onChange={(event) => onChange({ ...order, startDate: event.target.value })} /></label><label className="field-stack"><span>Entrega</span><input type="date" value={order.dueDate} onChange={(event) => onChange({ ...order, dueDate: event.target.value })} /></label></div></section><section className="document-section"><div className="section-caption"><Box size={17} /><span>Item e material</span></div><div className="dialog-form"><label className="field-stack field-span"><span>Item a desenvolver *</span><input value={order.title} onChange={(event) => onChange({ ...order, title: event.target.value })} placeholder="Ex.: acabamento para painel de porta" /></label><label className="field-stack field-span"><span>Material</span><select value={order.materialId} onChange={(event) => { const selected = materials.find((item) => item.id === event.target.value)!; onChange({ ...order, materialId: selected.id, materialName: selected.name }); }}>{materials.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="field-stack"><span>Material previsto (g)</span><input type="number" min="0" value={order.materialGrams || ""} onChange={(event) => onChange({ ...order, materialGrams: Number(event.target.value) })} placeholder="0" /></label></div>{material && <div className="material-info"><div><span className="material-swatch" style={{ background: material.color.toLowerCase() === "natural" ? "#dccaa5" : material.color.toLowerCase() }} /><b>{material.name}</b><small>{material.availableGrams} g em estoque · limite {material.reorderAtGrams} g</small></div><div><span>Bico</span><b>{material.nozzleTemp || "—"}</b></div><div><span>Mesa</span><b>{material.bedTemp || "—"}</b></div><p>{material.printNotes || "Sem observação técnica registrada."}</p></div>}</section></div><section className="document-section services-section"><div className="section-caption"><HardHat size={17} /><span>Composição do documento</span><small>Adicione somente o que se aplica ao processo.</small></div><div className="service-picker">{(["scan", "cad", "print", "post", "hardware", "shipping"] as OrderLine["service"][]).map((service) => <button type="button" key={service} onClick={() => addLine(service)}><Plus size={14} /> {serviceLabels[service]}</button>)}</div><div className="line-items">{order.lines.map((line) => <div className="line-item" key={line.id}><strong>{line.label}</strong><input aria-label={`${line.label} descrição`} value={line.description} onChange={(event) => updateLine(line.id, { description: event.target.value })} placeholder="Descrição" /><label>Qtd.<input type="number" min="0" step="0.25" value={line.quantity} onChange={(event) => updateLine(line.id, { quantity: Number(event.target.value) })} /></label><label>Valor unitário<input type="number" min="0" step="0.01" value={line.unitPrice} onChange={(event) => updateLine(line.id, { unitPrice: Number(event.target.value) })} /></label><b>{currency(line.quantity * line.unitPrice)}</b><button type="button" aria-label={`Remover ${line.label}`} className="icon-button" onClick={() => onChange({ ...order, lines: order.lines.filter((item) => item.id !== line.id) })}><X size={16} /></button></div>)}{!order.lines.length && <p className="muted-copy">Selecione os serviços acima para compor preço por hora, máquina, material, pós-processamento, hardware ou envio.</p>}</div></section><label className="field-stack"><span>Notas para o documento</span><textarea value={order.notes} onChange={(event) => onChange({ ...order, notes: event.target.value })} placeholder="Observações, condições, detalhes de engenharia ou de entrega…" /></label><div className="document-total"><span>Total estimado</span><strong>{currency(total)}</strong></div></div><div className="dialog-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancelar</button><button type="button" className="button button-primary" onClick={() => void onSave({ ...order, total })}>Salvar {order.documentType}</button></div></Modal>;
}
