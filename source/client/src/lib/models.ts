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
