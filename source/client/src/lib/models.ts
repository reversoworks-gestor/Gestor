export type ViewId =
  | "overview"
  | "orders"
  | "triage"
  | "clients"
  | "calendar"
  | "inventory"
  | "printers"
  | "settings";

export type Client = {
  id: string;
  name: string;
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
  service: "scan" | "cad" | "print" | "post" | "hardware" | "shipping";
  kind?: "item" | "service";
  taxable?: boolean;
  label: string;
  quantity: number;
  unitPrice: number;
  description: string;
};

export type Payment = {
  id: string;
  method: string;
  amount: number;
  date: string;
};
export type Attachment = {
  name: string;
  storagePath?: string;
  size?: number;
  contentType?: string;
};
export type Order = {
  id: string;
  documentType: "Orçamento" | "Invoice";
  status: "Rascunho" | "Enviado" | "Aprovado" | "Em produção";
  clientId: string;
  clientName: string;
  title: string;
  dueDate: string;
  startDate: string;
  materialId: string;
  materialName: string;
  materialGrams: number;
  notes: string;
  lines: OrderLine[];
  total: number;
  subtotal?: number;
  tax?: number;
  taxRate?: number;
  publicNote?: string;
  privateNote?: string;
  payments?: Payment[];
  attachments?: Attachment[];
  invoiceId?: string;
  createdAt: string;
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
