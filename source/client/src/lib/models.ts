export type ViewId =
  | "overview"
  | "estimates"
  | "invoices"
  | "orders"
  | "production"
  | "triage"
  | "clients"
  | "calendar"
  | "inventory"
  | "printers"
  | "parts"
  | "finance"
  | "expenses"
  | "more"
  | "settings";

export type Client = {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone: string;
  company: string;
  address: string;
  notes: string;
  updatedAt?: string;
};

export type Material = {
  id: string;
  name: string;
  color: string;
  type: string;
  availableGrams: number;
  reorderAtGrams: number;
  pricePerGram: number;
  nozzleTemp: string;
  bedTemp: string;
  printNotes: string;
  family?: string;
  manufacturer?: string;
  variant?: string;
  reinforcement?: string;
  density?: number;
  tensileStrengthXY?: number;
  tensileStrengthZ?: number;
  youngModulus?: number;
  flexuralStrength?: number;
  impactStrengthXY?: number;
  impactStrengthZ?: number;
  elongationAtBreak?: number;
  creepResistance?: number;
  fatigueResistance?: number;
  glassTransition?: number;
  hdt045?: number;
  hdt18?: number;
  vicat?: number;
  continuousServiceTemp?: number;
  peakServiceTemp?: number;
  uvResistance?: number;
  waterResistance?: number;
  moistureSensitivity?: number;
  oilResistance?: number;
  gasolineResistance?: number;
  dieselResistance?: number;
  coolantResistance?: number;
  brakeFluidResistance?: number;
  ipaResistance?: number;
  acidResistance?: number;
  alkaliResistance?: number;
  nozzleMinTemp?: number;
  nozzleMaxTemp?: number;
  bedMinTemp?: number;
  bedMaxTemp?: number;
  chamberRequirement?: "Aberta" | "Fechada" | "Alta temperatura";
  dryingTemperature?: number;
  dryingTimeHours?: number;
  warpingRisk?: "Baixo" | "Médio" | "Alto";
  abrasive?: boolean;
  hardenedNozzleRequired?: boolean;
  dataSource?: string;
  datasheetUrl?: string;
  testStandard?: string;
  confidenceLevel?: "Baixa" | "Média" | "Alta";
  lastUpdated?: string;
  technicalNotes?: string;
};

export type CalendarEvent = {
  id: string;
  title: string;
  detail: string;
  date: string;
  type: "order" | "triage" | "inventory" | "maintenance" | "calendar";
};

export type Printer = {
  id: string;
  name: string;
  model: string;
  status: "Pronta" | "Em manutenção" | "Pausada";
  material: string;
  lastMaintenance: string;
  maintenance: MaintenanceEntry[];
  maxNozzleTemp?: number;
  maxBedTemp?: number;
  maxChamberTemp?: number;
  buildVolume?: string;
  nozzleDiameter?: number;
  hardenedNozzle?: boolean;
  dryingAvailable?: boolean;
  compatibleMaterials?: string[];
};

export type MaintenanceEntry = {
  id: string;
  date: string;
  title: string;
  notes: string;
  status: "Concluída" | "Agendada";
};

export type OrderLine = {
  id: string;
  service: "scan" | "cad" | "print" | "post" | "hardware" | "shipping" | "custom";
  kind?: "item" | "service";
  taxable?: boolean;
  label: string;
  quantity: number;
  unitPrice: number;
  unitPriceCents?: number;
  unit?: "unidades" | "horas";
  description: string;
  materialId?: string;
  pricePerGram?: number;
  weightGrams?: number;
  printHours?: number;
  hourlyRate?: number;
  hourlyRateCents?: number;
  triageAnalysisId?: string;
  triageRecommendation?: string;
  triageScore?: number;
  triageConfidence?: number;
  catalogItemId?: string;
};

export type CatalogItem = {
  id: string;
  name: string;
  description: string;
  unitPrice: number;
  taxable: boolean;
  kind: "item" | "service";
  updatedAt?: string;
};

export type Payment = {
  id: string;
  method: string;
  amount: number;
  amountCents?: number;
  date: string;
};
export type Attachment = {
  id?: string;
  name: string;
  storagePath?: string;
  downloadUrl?: string;
  size?: number;
  contentType?: string;
  uploadedAt?: string;
};
export type Order = {
  id: string;
  documentType: "Estimativa" | "Orçamento" | "Invoice";
  status: "Rascunho" | "Enviado" | "Aprovado" | "Em produção";
  clientId: string;
  clientName: string;
  clientSnapshot?: Pick<Client, "name" | "firstName" | "lastName" | "email" | "phone" | "company" | "address">;
  title: string;
  dueDate: string;
  startDate: string;
  materialId: string;
  materialName: string;
  materialGrams: number;
  notes: string;
  lines: OrderLine[];
  total: number;
  totalCents?: number;
  subtotal?: number;
  subtotalCents?: number;
  tax?: number;
  taxCents?: number;
  taxRate?: number;
  publicNote?: string;
  privateNote?: string;
  payments?: Payment[];
  attachments?: Attachment[];
  invoiceId?: string;
  sourceEstimateId?: string;
  updatedAt?: string;
  createdAt: string;
};

export type Expense = {
  id: string;
  title: string;
  category: string;
  vendor: string;
  amount: number;
  amountCents: number;
  date: string;
  notes: string;
  createdAt: string;
  updatedAt?: string;
};

export type Part = {
  id: string;
  name: string;
  invoiceIds: string[];
  currentRevisionId?: string;
  createdAt: string;
  updatedAt?: string;
};

export type PartRevision = {
  id: string;
  partId: string;
  title: string;
  version: string;
  notes: string;
  attachments: Attachment[];
  invoiceIds: string[];
  createdAt: string;
  updatedAt?: string;
};

export type Triage = {
  id: string;
  piece: string;
  objective: string;
  material: string;
  complexity: string;
  urgency: string;
  notes: string;
  score: number;
  createdAt: string;
};
