import type {
  Attachment,
  CalendarEvent,
  CatalogItem,
  Client,
  Expense,
  Material,
  Order,
  Part,
  PartRevision,
  Printer,
  ViewId,
} from "../lib/models";
export type ServiceType =
  | "headlights"
  | "pdr"
  | "engineering"
  | "customization";
export type JourneyStage =
  | "evaluate"
  | "define"
  | "develop"
  | "execute"
  | "check";
export type StudioView = ViewId | "vehicles";
export const services: Record<
  ServiceType,
  { name: string; verb: string; limit: string }
> = {
  headlights: {
    name: "Restauração de faróis",
    verb: "Restore",
    limit:
      "A restauração externa não corrige danos internos, trincas estruturais, refletores comprometidos ou falhas de vedação.",
  },
  pdr: {
    name: "PDR — reparo sem pintura",
    verb: "Refine",
    limit:
      "A indicação depende da pintura, geometria, profundidade e acesso. Nem todo amassado é adequado ao PDR.",
  },
  engineering: {
    name: "Peças e engenharia",
    verb: "Recreate",
    limit:
      "Componentes críticos exigem validação de material, aplicação, montagem e requisitos de segurança.",
  },
  customization: {
    name: "Customização técnica",
    verb: "Refine",
    limit:
      "Avaliar materiais, interfaces, montagem, manutenção e impacto no conjunto antes da alteração.",
  },
};
export const journey: { id: JourneyStage; name: string; detail: string }[] = [
  { id: "evaluate", name: "Avaliar", detail: "Condição, função e necessidade" },
  { id: "define", name: "Definir", detail: "Escopo, premissas e aprovação" },
  { id: "develop", name: "Desenvolver", detail: "Geometria, CAD e protótipos" },
  { id: "execute", name: "Executar", detail: "Intervenção e processo" },
  { id: "check", name: "Conferir", detail: "Acabamento, montagem e entrega" },
];
export type Vehicle = {
  id: string;
  clientId: string;
  make: string;
  model: string;
  year: number;
  plate: string;
  vin: string;
  color: string;
  notes: string;
  updatedAt?: string;
};
export type Assessment = {
  id: string;
  serviceType: ServiceType;
  vehicleId: string;
  clientId: string;
  title: string;
  condition: string;
  objective: string;
  limitations: string;
  verdict: "Pendente" | "Viável" | "Não indicado" | "Requer inspeção";
  safetyCritical: boolean;
  photos: Attachment[];
  createdAt: string;
  updatedAt?: string;
};
export type StudioExpense = Expense & { currency?: "USD" | "BRL" };
export type StudioOrder = Order & {
  currency?: "USD" | "BRL";
  vehicleId?: string;
  serviceType?: ServiceType;
  journeyStage?: JourneyStage;
  scope?: string;
  constraints?: string;
  inspectionNotes?: string;
  finishApproved?: boolean;
  fitApproved?: boolean;
  clientApproved?: boolean;
  completed?: boolean;
};
export type Settings = {
  id: string;
  studioName: string;
  currency: "USD" | "BRL";
  taxRate: number;
  address: string;
  phone: string;
  email: string;
  publicFooter: string;
  updatedAt?: string;
};
export type EntityMap = {
  clients: Client;
  vehicles: Vehicle;
  orders: StudioOrder;
  materials: Material;
  printers: Printer;
  parts: Part;
  partRevisions: PartRevision;
  expenses: StudioExpense;
  calendar: CalendarEvent;
  triages: Assessment;
  catalogItems: CatalogItem;
  settings: Settings;
};
export type CollectionKey = keyof EntityMap;
export type StudioData = { [K in CollectionKey]: EntityMap[K][] };
export type GestorContext = {
  data: StudioData;
  settings: Settings;
  loading: boolean;
  error: string;
  mode: "firebase" | "demo" | "emulator";
  userName: string;
  owner: boolean;
  view: StudioView;
  navigate: (view: StudioView) => void;
  search: string;
  setSearch: (text: string) => void;
  notify: (text: string, kind?: "success" | "error" | "info") => void;
  retry: () => void;
  save: <K extends CollectionKey>(
    key: K,
    entity: EntityMap[K]
  ) => Promise<void>;
  remove: <K extends CollectionKey>(key: K, entityId: string) => Promise<void>;
  saveOrder: (order: StudioOrder) => Promise<void>;
  convertEstimate: (order: StudioOrder) => Promise<StudioOrder>;
  moveOrder: (order: StudioOrder, stage: JourneyStage) => Promise<void>;
  moveMaterial: (
    material: Material,
    grams: number,
    kind: "replenish" | "consume"
  ) => Promise<void>;
  saveRevision: (revision: PartRevision) => Promise<void>;
  upload: (
    recordId: string,
    file: File,
    kind?: "document" | "stl"
  ) => Promise<Attachment>;
  download: (attachment: Attachment) => Promise<void>;
  removeFile: (attachment: Attachment) => Promise<void>;
};
export const initialSettings: Settings = {
  id: "studio",
  studioName: "Reverso Works",
  currency: "USD",
  taxRate: 0,
  address: "",
  phone: "",
  email: "",
  publicFooter:
    "Restore. Refine. Recreate. — Serviços sujeitos à avaliação e ao escopo aprovado.",
};
export const makeId = (prefix = "record") => `${prefix}-${crypto.randomUUID()}`;
export const today = () => new Date().toLocaleDateString("en-CA");
export const money = (amount: number, currency: string = "USD") =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(
    Number.isFinite(amount) ? amount : 0
  );
export const dateLabel = (value: string) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(
        new Date(value.length === 10 ? `${value}T12:00:00` : value)
      )
    : "Não informado";
export const vehicleLabel = (vehicle?: Vehicle) =>
  vehicle
    ? `${vehicle.make} ${vehicle.model} · ${vehicle.year}${vehicle.plate ? ` · ${vehicle.plate}` : ""}`
    : "Veículo não vinculado";
