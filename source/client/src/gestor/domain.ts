import {
  calculateOrderTotals,
  centsToAmount,
  toCents,
  validatePayments,
} from "../lib/finance";
import type { Material, PartRevision } from "../lib/models";
import { timestampIso } from "./recordDates";
import {
  type Assessment,
  type CollectionKey,
  type EntityMap,
  type JourneyStage,
  type Settings,
  type StudioData,
  type StudioOrder,
  initialSettings,
  journey,
  makeId,
  services,
} from "./types";

export const collectionKeys: CollectionKey[] = [
  "clients",
  "vehicles",
  "orders",
  "materials",
  "printers",
  "parts",
  "partRevisions",
  "expenses",
  "calendar",
  "triages",
  "catalogItems",
  "settings",
];
export function emptyData(): StudioData {
  return Object.fromEntries(
    collectionKeys.map(key => [key, []])
  ) as unknown as StudioData;
}
export function requireText(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`${label}: preenchimento obrigatório.`);
}
export function requireNumber(
  value: unknown,
  label: string,
  min = 0,
  max = Number.MAX_SAFE_INTEGER
) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    throw new Error(`${label}: informe um número entre ${min} e ${max}.`);
}
export function isRealDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  if (year < 1900 || year > 2100) return false;
  const d = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
export function requireDate(value: string, label: string, optional = false) {
  if (optional && !value) return;
  if (!isRealDate(value))
    throw new Error(`${label}: informe uma data real entre 1900 e 2100.`);
}
export function safeRecord<T>(value: T): T {
  if (value === undefined) return value;
  if (Array.isArray(value)) return value.map(safeRecord) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([k, v]) => k !== "downloadUrl" && v !== undefined)
        .map(([k, v]) => [k, safeRecord(v)])
    ) as T;
  }
  return value;
}
export function normalizeRecord<K extends CollectionKey>(
  key: K,
  record: EntityMap[K],
  data?: StudioData
): EntityMap[K] {
  const value: any = safeRecord(record);
  requireText(value.id, "ID");
  switch (key) {
    case "clients": {
      const first = (value.firstName ?? value.name?.split(" ")[0] ?? "").trim();
      const last = (
        value.lastName ??
        (value.firstName === undefined
          ? value.name?.split(" ").slice(1).join(" ")
          : "") ??
        ""
      ).trim();
      requireText(first, "Primeiro nome");
      if (value.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email.trim()))
        throw new Error("Informe um e-mail válido.");
      value.firstName = first;
      value.lastName = last;
      value.name = [first, last].filter(Boolean).join(" ");
      break;
    }
    case "vehicles":
      requireText(value.clientId, "Cliente");
      requireText(value.make, "Marca");
      requireText(value.model, "Modelo");
      requireNumber(value.year, "Ano", 1900, 2100);
      if (!Number.isInteger(value.year))
        throw new Error("Ano deve ser inteiro.");
      if (data && !data.clients.some(c => c.id === value.clientId))
        throw new Error("Cliente não encontrado.");
      break;
    case "catalogItems":
      requireText(value.name, "Nome do item");
      requireNumber(value.unitPrice, "Preço unitário");
      const existingCatalog = data?.catalogItems.find(
        item => item.id === value.id
      );
      value.currency = existingCatalog
        ? (existingCatalog.currency ?? "USD")
        : (value.currency ?? "USD");
      if (!["USD", "BRL"].includes(value.currency))
        throw new Error("Moeda do catálogo inválida.");
      if (!["item", "service"].includes(value.kind))
        throw new Error("Tipo de catálogo inválido.");
      break;
    case "materials":
      requireText(value.name, "Nome do material");
      requireNumber(value.availableGrams, "Saldo");
      requireNumber(value.reorderAtGrams, "Ponto de reposição");
      requireNumber(value.pricePerGram, "Preço por grama");
      for (const [k, v] of Object.entries(value))
        if (typeof v === "number") requireNumber(v, k);
      break;
    case "printers": {
      requireText(value.name, "Nome da impressora");
      requireText(value.model, "Modelo");
      if (!["Pronta", "Em manutenção", "Pausada"].includes(value.status))
        throw new Error("Estado de impressora inválido.");
      for (const key of [
        "maxNozzleTemp",
        "maxBedTemp",
        "maxChamberTemp",
        "nozzleDiameter",
      ])
        if (value[key] !== undefined) requireNumber(value[key], key, 0, 1000);
      for (const entry of value.maintenance ?? []) {
        requireText(entry.title, "Título da manutenção");
        requireDate(entry.date, "Data da manutenção");
        if (!["Concluída", "Agendada"].includes(entry.status))
          throw new Error("Estado de manutenção inválido.");
      }
      value.lastMaintenance =
        (value.maintenance ?? [])
          .filter((e: any) => e.status === "Concluída")
          .map((e: any) => e.date)
          .sort()
          .at(-1) ||
        value.lastMaintenance ||
        "";
      break;
    }
    case "parts":
      requireText(value.name, "Nome da peça");
      for (const invoiceId of value.invoiceIds ?? [])
        if (
          data &&
          !data.orders.some(
            o => o.id === invoiceId && o.documentType === "Invoice"
          )
        )
          throw new Error("Invoice vinculada não encontrada.");
      break;
    case "partRevisions":
      requireText(value.partId, "Peça");
      requireText(value.title, "Título da revisão");
      requireText(value.version, "Versão");
      if (value.version.trim().startsWith("-"))
        throw new Error(
          "A versão não pode ser negativa. Use um identificador como v1 ou 1.0."
        );
      if (data && !data.parts.some(p => p.id === value.partId))
        throw new Error("Peça não encontrada.");
      break;
    case "expenses":
      requireText(value.title, "Descrição da despesa");
      requireText(value.category, "Categoria");
      requireDate(value.date, "Data da despesa");
      requireNumber(value.amount, "Valor da despesa");
      value.amountCents = toCents(value.amount);
      value.amount = centsToAmount(value.amountCents);
      value.currency = value.currency ?? "USD";
      if (!["USD", "BRL"].includes(value.currency))
        throw new Error("Moeda inválida.");
      break;
    case "calendar":
      requireText(value.title, "Título do evento");
      if (
        !["order", "triage", "inventory", "maintenance", "calendar"].includes(
          value.type
        )
      )
        throw new Error("Categoria do evento inválida.");
      {
        const date = new Date(value.date);
        if (
          !Number.isFinite(date.getTime()) ||
          date.getFullYear() < 1900 ||
          date.getFullYear() > 2100
        )
          throw new Error("Informe data e hora válidas entre 1900 e 2100.");
        value.date = date.toISOString();
      }
      break;
    case "triages":
      if (value.serviceType) {
        requireText(value.title, "Título da avaliação");
        requireText(value.condition, "Condição observada");
        requireText(value.objective, "Objetivo");
        if (!(value.serviceType in services))
          throw new Error("Serviço inválido.");
        if (
          !["Pendente", "Viável", "Não indicado", "Requer inspeção"].includes(
            value.verdict
          )
        )
          throw new Error("Conclusão inválida.");
        if (value.safetyCritical && value.verdict === "Viável")
          throw new Error(
            "Aplicações críticas exigem inspeção e validação documentada; use Requer inspeção."
          );
      } else
        requireText(value.piece || value.title, "Identificação da análise");
      break;
    case "settings":
      requireText(value.studioName, "Nome do estúdio");
      if (!["USD", "BRL"].includes(value.currency))
        throw new Error("Moeda inválida.");
      requireNumber(value.taxRate, "Taxa", 0, 1);
      if (value.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email))
        throw new Error("E-mail de contato inválido.");
      break;
    case "orders":
      return normalizeStudioOrder(value, data) as EntityMap[K];
  }
  value.updatedAt = new Date().toISOString();
  return value;
}
export function normalizeStudioOrder(
  source: StudioOrder,
  data?: StudioData
): StudioOrder {
  requireText(source.id, "ID");
  requireText(source.title, "Título");
  requireText(source.clientId, "Cliente");
  if (!["Estimativa", "Orçamento", "Invoice"].includes(source.documentType))
    throw new Error("Tipo de documento inválido.");
  if (
    !["Rascunho", "Enviado", "Aprovado", "Em produção"].includes(source.status)
  )
    throw new Error("Status de documento inválido.");
  if ((source.lines?.length ?? 0) + (source.payments?.length ?? 0) > 20)
    throw new Error(
      "Um documento comporta até 20 lançamentos entre itens e pagamentos. Divida documentos maiores mantendo o vínculo no escopo."
    );
  if (!source.lines?.length)
    throw new Error("Adicione ao menos um item ou serviço.");
  requireDate(source.startDate, "Emissão");
  requireDate(source.dueDate, "Entrega", true);
  if (source.dueDate && source.dueDate < source.startDate)
    throw new Error("A entrega não pode anteceder a emissão.");
  requireNumber(source.taxRate ?? 0, "Taxa", 0, 1);
  requireNumber(source.materialGrams ?? 0, "Material em gramas");
  if (source.journeyStage && !journey.some(s => s.id === source.journeyStage))
    throw new Error("Etapa inválida.");
  if (
    source.completed &&
    (!(source.finishApproved && source.fitApproved && source.clientApproved) ||
      source.journeyStage !== "check")
  )
    throw new Error(
      "A entrega exige etapa Conferir, acabamento, montagem e aprovação do cliente registrados."
    );
  if (source.completed)
    requireText(source.inspectionNotes, "Notas de conferência para entrega");
  if (source.currency && !["USD", "BRL"].includes(source.currency))
    throw new Error("Moeda inválida.");
  const previous = data?.orders.find(order => order.id === source.id);
  const changedClient = Boolean(
    previous && previous.clientId !== source.clientId
  );
  const client = data?.clients.find(c => c.id === source.clientId);
  if (data && !client) throw new Error("Cliente não encontrado.");
  if (source.vehicleId && data) {
    const vehicle = data.vehicles.find(v => v.id === source.vehicleId);
    if (!vehicle || vehicle.clientId !== source.clientId)
      throw new Error("O veículo deve pertencer ao cliente selecionado.");
  }
  const lines = source.lines.map(line => {
    requireText(line.label, "Descrição do item");
    requireNumber(line.quantity, "Quantidade", 0.000001);
    requireNumber(line.unitPrice, "Preço unitário");
    for (const k of [
      "weightGrams",
      "printHours",
      "pricePerGram",
      "hourlyRate",
    ] as const)
      if (line[k] !== undefined) requireNumber(line[k], k);
    return {
      ...line,
      unitPriceCents: toCents(line.unitPrice),
      taxable: line.kind === "item" && line.taxable !== false,
    };
  });
  const payments = (source.payments ?? []).map(p => {
    requireNumber(p.amount, "Valor do pagamento");
    requireDate(p.date, "Data do pagamento");
    return { ...p, amountCents: toCents(p.amount) };
  });
  const totals = calculateOrderTotals(lines, source.taxRate ?? 0);
  if (
    !Number.isSafeInteger(totals.totalCents) ||
    lines.some(line => !Number.isSafeInteger(line.unitPriceCents))
  )
    throw new Error(
      "Valor monetário excede a precisão segura. Divida o documento em valores menores."
    );
  const error = validatePayments(totals.totalCents, payments);
  if (error) throw new Error(error);
  return safeRecord({
    ...source,
    currency: source.currency ?? "USD",
    lines,
    payments,
    clientName:
      source.documentType === "Invoice" &&
      source.clientSnapshot &&
      !changedClient
        ? source.clientSnapshot.name
        : (client?.name ?? source.clientName),
    clientSnapshot:
      source.documentType === "Invoice" &&
      source.clientSnapshot &&
      !changedClient
        ? source.clientSnapshot
        : client
          ? {
              name: client.name,
              firstName: client.firstName,
              lastName: client.lastName,
              email: client.email,
              phone: client.phone,
              company: client.company,
              address: client.address,
            }
          : source.clientSnapshot,
    subtotalCents: totals.subtotalCents,
    subtotal: centsToAmount(totals.subtotalCents),
    taxCents: totals.taxCents,
    tax: centsToAmount(totals.taxCents),
    totalCents: totals.totalCents,
    total: centsToAmount(totals.totalCents),
    updatedAt: new Date().toISOString(),
  });
}
export function allocations(order?: StudioOrder): Record<string, number> {
  if (!order || order.documentType !== "Invoice") return {};
  const result: Record<string, number> = {};
  for (const line of order.lines ?? [])
    if (line.materialId && line.weightGrams && line.quantity)
      result[line.materialId] =
        (result[line.materialId] ?? 0) + line.weightGrams * line.quantity;
  if (
    !Object.keys(result).length &&
    order.materialId &&
    order.materialGrams > 0
  )
    result[order.materialId] = order.materialGrams;
  return result;
}
export function reserveMaterials(
  previous: StudioOrder | undefined,
  next: StudioOrder | undefined,
  materials: Material[]
): Material[] {
  const before = allocations(previous),
    after = allocations(next);
  const ids = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  return ids.map(id => {
    const material = materials.find(m => m.id === id);
    if (!material)
      throw new Error("Material reservado não encontrado no estoque.");
    requireNumber(material.availableGrams, "Saldo atual");
    const balance =
      Math.round(
        (material.availableGrams + (before[id] ?? 0) - (after[id] ?? 0)) * 1000
      ) / 1000;
    if (balance < 0)
      throw new Error(
        `Estoque insuficiente para ${material.name}. Disponível: ${material.availableGrams} g.`
      );
    return { ...material, availableGrams: balance };
  });
}
export function safeDelete(key: CollectionKey, id: string, data: StudioData) {
  if (
    key === "clients" &&
    (data.orders.some(o => o.clientId === id) ||
      data.vehicles.some(v => v.clientId === id) ||
      data.triages.some(t => t.clientId === id))
  )
    throw new Error(
      "Cliente vinculado a veículos ou documentos; remova os vínculos antes de excluir."
    );
  if (
    key === "vehicles" &&
    (data.orders.some(o => o.vehicleId === id) ||
      data.triages.some(t => t.vehicleId === id))
  )
    throw new Error("Veículo vinculado a documentos ou avaliações.");
  if (
    key === "materials" &&
    data.orders.some(
      o => o.materialId === id || o.lines.some(l => l.materialId === id)
    )
  )
    throw new Error(
      "Material vinculado a documento; preserve o registro técnico."
    );
  if (key === "parts" && data.partRevisions.some(r => r.partId === id))
    throw new Error(
      "A peça possui revisões; remova ou transfira suas revisões antes."
    );
  if (
    key === "orders" &&
    (data.parts.some(p => p.invoiceIds.includes(id)) ||
      data.partRevisions.some(r => r.invoiceIds.includes(id)) ||
      data.orders.some(o => o.sourceEstimateId === id || o.invoiceId === id))
  )
    throw new Error(
      "Documento vinculado a conversão ou peça; preserve a rastreabilidade."
    );
  if (key === "settings")
    throw new Error("A configuração do estúdio não pode ser excluída.");
}
export function loadLegacy<K extends CollectionKey>(
  key: K,
  source: any
): EntityMap[K] {
  if (key === "triages" && !source.serviceType) {
    return {
      ...source,
      serviceType: "engineering",
      title:
        source.title ||
        source.piece ||
        source.project ||
        "Triagem técnica legada",
      clientId: source.clientId || "",
      vehicleId: source.vehicleId || "",
      condition:
        source.condition ||
        "Condições registradas no histórico técnico original.",
      objective:
        source.objective ||
        source.application ||
        source.recommendation ||
        "Seleção preliminar de material",
      limitations:
        source.limitations ||
        "Orientação legada; confirmar geometria, processo e peça física.",
      verdict: "Requer inspeção",
      safetyCritical: false,
      photos: source.photos ?? source.attachments ?? [],
      createdAt:
        typeof source.createdAt === "string"
          ? source.createdAt
          : new Date(0).toISOString(),
    } as EntityMap[K];
  }
  if (key === "orders") {
    return {
      ...source,
      createdAt: timestampIso(source.createdAt) ?? "",
      updatedAt: timestampIso(source.updatedAt),
      currency: source.currency ?? "USD",
      lines: source.lines ?? [],
      payments: source.payments ?? [],
      attachments: safeRecord(source.attachments ?? []),
      journeyStage:
        source.journeyStage ??
        (
          {
            planning: "evaluate",
            approval: "define",
            production: "execute",
            quality: "check",
            shipping: "check",
          } as any
        )[source.productionStage ?? "planning"],
    } as EntityMap[K];
  }
  return safeRecord(source);
}
export function demoData(): StudioData {
  const data = emptyData();
  const now = new Date().toISOString(),
    day = now.slice(0, 10);
  data.settings = [initialSettings];
  data.clients = [
    {
      id: "demo-client",
      name: "Cliente de demonstração",
      firstName: "Cliente",
      lastName: "de demonstração",
      email: "demo@example.test",
      phone: "",
      company: "Dados sintéticos",
      address: "",
      notes: "Registro fictício, sem vínculo com clientes reais.",
    },
  ];
  data.vehicles = [
    {
      id: "demo-vehicle",
      clientId: "demo-client",
      make: "Veículo",
      model: "de demonstração",
      year: 2020,
      plate: "DEMO-001",
      vin: "",
      color: "Prata",
      notes: "Dados sintéticos para explorar os fluxos.",
    },
  ];
  data.materials = [
    {
      id: "demo-petg",
      name: "PETG · demonstração",
      color: "Preto",
      type: "PETG",
      availableGrams: 1000,
      reorderAtGrams: 250,
      pricePerGram: 0.03,
      nozzleTemp: "230–250",
      bedTemp: "70–80",
      printNotes: "Propriedades devem ser conferidas no datasheet da marca.",
    },
  ];
  data.catalogItems = Object.entries(services).map(([key, service]) => ({
    id: `catalog-${key}`,
    name: service.name,
    description: service.limit,
    unitPrice: 0,
    taxable: false,
    kind: "service",
  }));
  data.printers = [
    {
      id: "demo-printer",
      name: "Impressora de demonstração",
      model: "Perfil técnico sintético",
      status: "Pronta",
      material: "PETG",
      lastMaintenance: "",
      maintenance: [],
      maxNozzleTemp: 300,
      maxBedTemp: 120,
      maxChamberTemp: 50,
      nozzleDiameter: 0.4,
      compatibleMaterials: ["PETG"],
      dryingAvailable: true,
      hardenedNozzle: false,
    },
  ];
  data.orders = journey.slice(0, 3).map((stage, i) =>
    normalizeStudioOrder(
      {
        id: `demo-job-${i + 1}`,
        documentType: "Invoice",
        status: i === 0 ? "Rascunho" : "Aprovado",
        clientId: "demo-client",
        clientName: "Cliente de demonstração",
        vehicleId: "demo-vehicle",
        title: [
          "Avaliação de faróis",
          "Reparo de painel · PDR",
          "Desenvolvimento de suporte",
        ][i],
        serviceType: ["headlights", "pdr", "engineering"][i] as any,
        journeyStage: stage.id,
        startDate: day,
        dueDate: "",
        materialId: "",
        materialName: "",
        materialGrams: 0,
        notes: "Dados de demonstração",
        lines: [
          {
            id: `demo-line-${i}`,
            service: "custom",
            kind: "service",
            taxable: false,
            label: ["Restauração de faróis", "PDR", "Estudo de componente"][i],
            quantity: 1,
            unitPrice: 100 + i * 50,
            description: "Escopo demonstrativo",
          },
        ],
        payments: [],
        total: 0,
        createdAt: now,
      },
      data
    )
  );
  data.calendar = [
    {
      id: "demo-event",
      title: "Inspeção inicial · demonstração",
      detail:
        "Apresentar condição, referências e limites antes de definir o serviço.",
      date: now,
      type: "calendar",
    },
  ];
  return data;
}
