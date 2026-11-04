import { centsToAmount, toCents } from "../lib/finance";
import type { Attachment, Payment } from "../lib/models";
import type { StudioData, StudioOrder } from "./types";
import {
  categoryForCodes,
  expandService,
  findService,
  validateServiceCodes,
  type ServiceCategory,
} from "./serviceCatalog";

export type PipelineStage =
  | "lead"
  | "evaluation"
  | "quote"
  | "approved"
  | "scheduled"
  | "production"
  | "quality"
  | "delivered"
  | "aftercare";
export const pipeline: { id: PipelineStage; name: string; detail: string }[] = [
  { id: "lead", name: "Lead", detail: "Contato inicial do cliente" },
  {
    id: "evaluation",
    name: "Avaliação",
    detail: "Fotos recebidas ou inspeção presencial",
  },
  {
    id: "quote",
    name: "Orçamento enviado",
    detail: "Preço e prazo calculados",
  },
  { id: "approved", name: "Aprovado", detail: "Cliente aceitou" },
  { id: "scheduled", name: "Agendado", detail: "Data de entrada definida" },
  { id: "production", name: "Em produção", detail: "Execução começou" },
  { id: "quality", name: "Controle de qualidade", detail: "Execução terminou" },
  {
    id: "delivered",
    name: "Entregue / Pago",
    detail: "Cliente buscou e pagou",
  },
  { id: "aftercare", name: "Pós-venda", detail: "Após a entrega" },
];
export type WorkflowTask = {
  id: string;
  category: ServiceCategory;
  title: string;
  required: boolean;
  photo?: "before" | "after";
  serviceCode?: string;
  step: number;
};
export type JobWorkflow = {
  version: 1;
  stage: PipelineStage;
  serviceCodes: string[];
  packageCode?: string;
  problem: string;
  tasks: Record<string, { done: boolean; completedAt?: string }>;
  beforePhotos: Attachment[];
  afterPhotos: Attachment[];
  quotedAmount: number | null;
  estimatedDeadline: string;
  depositApplicable: boolean;
  depositAmount: number | null;
  depositDate: string;
  materialCost: number | null;
  materialPurchasedOn: string;
  hoursWorked: number | null;
  finalAmount: number | null;
  paymentMethod: string;
  paymentDate: string;
  entryDate: string;
  promisedDate: string;
  deliveryDate: string;
  reviewRequested: boolean | null;
  details: Record<string, string | boolean>;
  cadVersions: string[];
  repairMode: "repair" | "recreate" | "";
};
type Field = {
  key: string;
  label: string;
  type: "text" | "date" | "boolean" | "textarea";
};
export const categoryFields: Record<ServiceCategory, Field[]> = {
  DET: [
    {
      key: "DET.preexistingDamage",
      label: "Danos pré-existentes",
      type: "textarea",
    },
    {
      key: "DET.upsellApproved",
      label: "Upsell aprovado pelo cliente",
      type: "boolean",
    },
    { key: "DET.testSpotDone", label: "Test spot feito", type: "boolean" },
    { key: "DET.compoundPad", label: "Composto / boina usados", type: "text" },
    {
      key: "DET.rotation",
      label: "Rotação definida no test spot",
      type: "text",
    },
    {
      key: "DET.protectionProduct",
      label: "Proteção aplicada (produto)",
      type: "text",
    },
    { key: "DET.protectionDate", label: "Data da proteção", type: "date" },
    {
      key: "DET.cureRespected",
      label: "Tempo de cura respeitado",
      type: "boolean",
    },
    {
      key: "DET.nextMaintenance",
      label: "Próxima manutenção sugerida",
      type: "text",
    },
  ],
  PDR: [
    { key: "PDR.panel", label: "Painel trabalhado", type: "text" },
    {
      key: "PDR.sizeDepth",
      label: "Tamanho / profundidade do amassado",
      type: "text",
    },
    { key: "PDR.access", label: "Acesso por trás do painel", type: "text" },
    { key: "PDR.paintIntact", label: "Pintura intacta", type: "boolean" },
    {
      key: "PDR.feasibility",
      label: "Decisão de viabilidade e escopo (touch-up se necessário)",
      type: "textarea",
    },
    {
      key: "PDR.technique",
      label: "Técnica (alavanca / glue pull)",
      type: "text",
    },
    {
      key: "PDR.removedAccessItems",
      label: "Itens de acesso removidos (ou nenhum)",
      type: "textarea",
    },
  ],
  FAR: [
    {
      key: "FAR.damageType",
      label: "Dano externo / interno / trinca",
      type: "text",
    },
    {
      key: "FAR.expectationAligned",
      label: "Limitação interna / trinca alinhada com o cliente",
      type: "boolean",
    },
    {
      key: "FAR.grits",
      label: "Grãos usados (sequência progressiva, sem pular)",
      type: "text",
    },
    {
      key: "FAR.protectionProduct",
      label: "Proteção aplicada (produto)",
      type: "text",
    },
    { key: "FAR.protectionDate", label: "Data da proteção", type: "date" },
    {
      key: "FAR.cureRespected",
      label: "Tempo de cura respeitado",
      type: "boolean",
    },
  ],
  P3D: [
    {
      key: "P3D.functionLoads",
      label: "Função / esforços (calor, vibração, sol, peso)",
      type: "textarea",
    },
    {
      key: "P3D.feasibility",
      label: "Viabilidade para a função registrada",
      type: "textarea",
    },
    {
      key: "P3D.quoteBreakdown",
      label: "Orçamento separado: scan/CAD, impressão, acabamento, instalação",
      type: "textarea",
    },
    {
      key: "P3D.materialFinal",
      label: "Material final escolhido pela função",
      type: "text",
    },
    {
      key: "P3D.approvedCadVersion",
      label: "Versão do CAD aprovada",
      type: "text",
    },
    { key: "P3D.fitApproved", label: "Fit test aprovado", type: "boolean" },
    {
      key: "P3D.fitDate",
      label: "Data de aprovação do fit test",
      type: "date",
    },
    {
      key: "P3D.fitApprovedBy",
      label: "Fit test aprovado por quem / no veículo",
      type: "text",
    },
    {
      key: "P3D.projectFolder",
      label: "Link HTTPS da pasta do projeto (scan e CAD arquivados)",
      type: "text",
    },
    {
      key: "P3D.scanFileUrl",
      label: "Link HTTPS do scan / registro de medição (manifesto do job)",
      type: "text",
    },
    {
      key: "P3D.cadFileUrl",
      label: "Link HTTPS do CAD final (manifesto do job)",
      type: "text",
    },
    {
      key: "P3D.printSettings",
      label: "Configurações de impressão arquivadas",
      type: "textarea",
    },
  ],
};

export function createWorkflow(
  serviceCodes: string[],
  packageCode?: string
): JobWorkflow {
  let codes = [...new Set(serviceCodes)];
  // Accept a commercial package alone as a convenience, never infer PCT-03's alternative.
  if (
    !packageCode &&
    codes.length === 1 &&
    findService(codes[0])?.type === "Pacote"
  ) {
    packageCode = codes[0];
    codes = expandService(packageCode);
  }
  if (codes.length) validateServiceCodes(codes);
  if (packageCode) validatePackage(codes, packageCode);
  return {
    version: 1,
    stage: "lead",
    serviceCodes: codes,
    ...(packageCode ? { packageCode } : {}),
    problem: "",
    tasks: {},
    beforePhotos: [],
    afterPhotos: [],
    quotedAmount: null,
    estimatedDeadline: "",
    depositApplicable: false,
    depositAmount: null,
    depositDate: "",
    materialCost: null,
    materialPurchasedOn: "",
    hoursWorked: null,
    finalAmount: null,
    paymentMethod: "",
    paymentDate: "",
    entryDate: "",
    promisedDate: "",
    deliveryDate: "",
    reviewRequested: null,
    details: {},
    cadVersions: [],
    repairMode: "",
  };
}
function validatePackage(codes: string[], packageCode: string): void {
  const item = findService(packageCode);
  if (!item || item.type !== "Pacote")
    throw new Error(`Pacote inválido: ${packageCode}.`);
  const chosen = item.alternatives?.filter(code => codes.includes(code));
  if (chosen && chosen.length !== 1)
    throw new Error(
      `${packageCode}: escolha exatamente uma alternativa (${item.alternatives?.join(" ou ")}).`
    );
  for (const code of expandService(packageCode, chosen?.[0]))
    if (!codes.includes(code))
      throw new Error(`${packageCode}: componente obrigatório ${code}.`);
}
function categoryChecklist(
  workflow: JobWorkflow,
  category: ServiceCategory
): WorkflowTask[] {
  const has = (code: string) => workflow.serviceCodes.includes(code);
  const list: WorkflowTask[] = [];
  const add = (
    step: number,
    title: string,
    options: Partial<WorkflowTask> = {}
  ) =>
    list.push({
      id: `${category}-${String(step).padStart(2, "0")}`,
      category,
      step,
      title,
      required: false,
      ...options,
    });
  switch (category) {
    case "DET":
      add(
        1,
        "Recebimento e inspeção — fotos 360° e close dos defeitos sob luz; registrar danos pré-existentes",
        { photo: "before" }
      );
      add(
        2,
        "Pré-lavagem, lavagem e descontaminação (clay, se houver correção)"
      );
      add(
        3,
        "Avaliação da pintura — detailing ou correção; registrar upsell aprovado"
      );
      add(4, "Mascaramento de plásticos, borrachas e emblemas");
      if (has("DET-02")) {
        add(
          5,
          "Test spot primeiro — definir composto, boina e rotação; só então expandir a correção",
          { id: "DET-05-test-spot", required: true, serviceCode: "DET-02" }
        );
        add(5, "Correção do veículo todo somente após o test spot", {
          required: true,
          serviceCode: "DET-02",
        });
      }
      add(
        6,
        "Interior completo — aspiração, tecidos/couro, plásticos e vidros internos"
      );
      for (const code of ["DET-05", "DET-06", "DET-07"])
        if (has(code))
          add(7, `${findService(code)?.name} — antes da proteção`, {
            id: `DET-07-${code}`,
            serviceCode: code,
          });
      for (const code of ["DET-03", "DET-04"])
        if (has(code))
          add(
            8,
            "Proteção sobre pintura limpa e corrigida; registrar produto/data e respeitar cura",
            { id: `DET-08-${code}`, serviceCode: code }
          );
      add(
        9,
        "Controle de qualidade sob luz forte e vários ângulos; fotos depois nos ângulos de antes",
        { photo: "after" }
      );
      add(
        10,
        "Entrega — walk-around com cliente e instruções de manutenção/cura"
      );
      break;
    case "PDR":
      add(
        1,
        "Avaliação do amassado — tamanho, profundidade, acesso e pintura intacta; decisão de viabilidade",
        { required: true }
      );
      add(2, "Orçamento por painel/amassado e foto do dano sob luz de PDR", {
        photo: "before",
      });
      add(
        3,
        "Preparação de acesso — registrar forro/lanterna/acabamento removidos"
      );
      add(
        4,
        "Trabalho sob luz de PDR — alavanca/glue pull em pequenas passadas, conferindo cada uma"
      );
      add(5, "Refinamento — baixar pontos altos e igualar a textura do painel");
      for (const code of ["PDR-02", "PDR-03"])
        if (has(code))
          add(6, findService(code)!.name, {
            id: `PDR-06-${code}`,
            serviceCode: code,
          });
      add(
        7,
        "Controle de qualidade — luz de PDR e natural, frente e lado; foto depois na posição da avaliação",
        { photo: "after" }
      );
      add(
        8,
        "Remontagem de tudo que foi removido e entrega com walk-around lateral"
      );
      break;
    case "FAR":
      add(
        1,
        "Avaliação — dano externo ou interno/trinca; alinhar expectativa antes de orçar",
        { required: true }
      );
      add(2, "Foto antes padronizada dos dois faróis — mesma distância e luz", {
        photo: "before",
      });
      add(3, "Mascaramento de toda pintura e trim ao redor do farol");
      add(
        4,
        "Lixamento progressivo — grão mais agressivo ao mais fino, sem pular grão"
      );
      add(5, "Polimento até a lente transparente; conferir contra a luz");
      if (has("FAR-02"))
        add(
          6,
          "Proteção — limpeza final, aplicação, cura e registro de produto/data",
          { serviceCode: "FAR-02" }
        );
      add(
        7,
        "Controle de qualidade — faróis lado a lado, claridade/uniformidade; foto depois idêntica à antes",
        { photo: "after" }
      );
      add(8, "Entrega — orientar sobre vida útil da proteção");
      break;
    case "P3D": {
      const physical = has("P3D-01") || has("P3D-02") || has("P3D-05");
      const repairOnly =
        has("P3D-05") &&
        workflow.repairMode === "repair" &&
        !has("P3D-01") &&
        !has("P3D-02");
      add(
        1,
        "Intake — fotos da peça/ausência, local, função e esforços (calor, vibração, sol, peso)",
        { photo: "before" }
      );
      add(
        2,
        "Viabilidade e orçamento — separar scan/CAD, impressão, acabamento, instalação; reparar ou recriar se P3D-05"
      );
      if (!repairOnly) {
        add(
          3,
          "Scan 3D e/ou medição — conferir medidas críticas com paquímetro"
        );
        add(
          4,
          "CAD — salvar v1; toda revisão é nova versão, nunca sobrescrever"
        );
      }
      // B2B is exactly 1–4. File delivery/archive is validated at the delivery gate.
      if (!physical) break;
      if (repairOnly)
        add(5, "Reparar a peça existente — testar integridade e função", {
          id: "P3D-05-repair",
          serviceCode: "P3D-05",
        });
      else {
        add(5, "Protótipo — impressão rápida apenas para forma e encaixe");
        add(
          6,
          "FIT TEST — aprovação do cliente ou no veículo; reprovação volta ao CAD com nova versão",
          { required: true }
        );
        add(
          7,
          "Impressão final — material escolhido pela função registrada, nunca por disponibilidade"
        );
      }
      if (has("P3D-03"))
        add(8, "Acabamento OEM — lixa, primer, textura e pintura", {
          serviceCode: "P3D-03",
        });
      if (has("P3D-06"))
        add(9, "Instalação — testar a função no lugar e fotografar instalada", {
          photo: "after",
          serviceCode: "P3D-06",
        });
      add(
        10,
        "Entrega e arquivo — scan, CAD aprovado, material e configurações vinculados ao job",
        { photo: "after" }
      );
      break;
    }
  }
  return list;
}

export function buildChecklist(workflow: JobWorkflow): WorkflowTask[] {
  let categories = categoryForCodes(workflow.serviceCodes);
  if (workflow.packageCode === "PCT-02")
    categories = [
      "PDR",
      "DET",
      ...categories.filter(c => c !== "PDR" && c !== "DET"),
    ];
  if (workflow.packageCode === "PCT-01") {
    const far = categoryChecklist(workflow, "FAR"),
      det = categoryChecklist(workflow, "DET");
    // Do not defer merely the FAR protection: its QC and delivery must also stay after protection.
    return [
      ...far.filter(task => task.step <= 5),
      ...det.filter(task => task.step < 8),
      ...far.filter(task => task.step === 6),
      ...det.filter(task => task.step === 8),
      ...far.filter(task => task.step >= 7),
      ...det.filter(task => task.step >= 9),
      ...categories
        .filter(c => c !== "FAR" && c !== "DET")
        .flatMap(c => categoryChecklist(workflow, c)),
    ];
  }
  return categories.flatMap(category => categoryChecklist(workflow, category));
}

/** A display-only projection. No workflow or legacy metadata is written or mutated. */
export function workflowForOrder(order: StudioOrder): JobWorkflow {
  const source = (order as StudioOrder & { workflow?: JobWorkflow }).workflow;
  if (source) return structuredClone(source);
  const workflow: JobWorkflow = {
    version: 1,
    stage: "lead",
    serviceCodes: [],
    problem: order.scope || order.notes || "",
    tasks: {},
    beforePhotos: structuredClone(order.attachments ?? []),
    afterPhotos: [],
    quotedAmount: null,
    estimatedDeadline: order.dueDate || "",
    depositApplicable: false,
    depositAmount: null,
    depositDate: "",
    materialCost: null,
    materialPurchasedOn: "",
    hoursWorked: null,
    finalAmount: null,
    paymentMethod: "",
    paymentDate: "",
    entryDate: "",
    promisedDate: order.dueDate || "",
    deliveryDate: "",
    reviewRequested: null,
    details: {},
    cadVersions: [],
    repairMode: "",
  };
  if (order.completed) workflow.stage = "delivered";
  else if (
    order.journeyStage === "check" ||
    order.productionStage === "quality"
  )
    workflow.stage = "quality";
  else if (
    ["develop", "execute"].includes(order.journeyStage || "") ||
    order.productionStage === "production" ||
    order.status === "Em produção"
  )
    workflow.stage = "production";
  else if (order.productionStage === "shipping") workflow.stage = "delivered";
  else if (order.status === "Aprovado" || order.productionStage === "approval")
    workflow.stage = "approved";
  else if (order.status === "Enviado") workflow.stage = "quote";
  else if (order.journeyStage === "evaluate" || order.journeyStage === "define")
    workflow.stage = "evaluation";
  // Preserve actual historical prices, not the zero placeholder of an unpriced new line.
  if (
    order.lines?.length &&
    !order.lines.some(
      line => (line as typeof line & { pricePending?: boolean }).pricePending
    ) &&
    Number.isFinite(order.total)
  )
    workflow.quotedAmount = order.total;
  return workflow;
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim());
}
function validHttpsUrl(value: unknown): value is string {
  if (!hasText(value) || !/^https:\/\//i.test(value.trim())) return false;
  try {
    const url = new URL(value.trim());
    return (
      url.protocol === "https:" &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const year = Number(value.slice(0, 4));
  const date = new Date(`${value}T12:00:00Z`);
  return (
    year >= 1900 &&
    year <= 2100 &&
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}
function finiteAmount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    Number.isSafeInteger(toCents(value))
  );
}
function isImage(attachment: Attachment): boolean {
  return Boolean(
    attachment &&
      hasText(attachment.storagePath) &&
      !/^(?:https?:|data:|blob:)/i.test(attachment.storagePath) &&
      typeof attachment.contentType === "string" &&
      /^image\//i.test(attachment.contentType)
  );
}
function photoIssues(
  workflow: JobWorkflow,
  side: "before" | "after"
): string[] {
  const photos =
    side === "before" ? workflow.beforePhotos : workflow.afterPhotos;
  return Array.isArray(photos) && photos.length > 0 && photos.every(isImage)
    ? []
    : [
        `Fotos ${side === "before" ? "antes" : "depois"}: anexe imagem real com storagePath e contentType de imagem.`,
      ];
}
function detailText(
  workflow: JobWorkflow,
  key: string,
  issues: string[],
  label?: string
) {
  if (!hasText(workflow.details[key]))
    issues.push(`${label || key}: preenchimento obrigatório.`);
}
function detailDate(workflow: JobWorkflow, key: string, issues: string[]) {
  if (!validDate(workflow.details[key]))
    issues.push(`${key}: informe uma data real.`);
}
function projectFileIssues(
  workflow: JobWorkflow,
  folderLabel?: string
): string[] {
  const issues: string[] = [];
  for (const [key, label] of [
    ["P3D.projectFolder", folderLabel || "P3D.projectFolder"],
    ["P3D.scanFileUrl", "P3D.scanFileUrl (scan / registro de medição)"],
    ["P3D.cadFileUrl", "P3D.cadFileUrl (CAD final)"],
  ])
    if (!validHttpsUrl(workflow.details[key]))
      issues.push(
        `${label}: informe um link HTTPS válido no manifesto do job.`
      );
  return issues;
}
function fitIssues(workflow: JobWorkflow): string[] {
  const issues: string[] = [];
  if (workflow.details["P3D.fitApproved"] !== true)
    issues.push(
      "FIT TEST: encaixe deve ser testado e aprovado antes da impressão final; se reprovado, voltar ao CAD com nova versão."
    );
  detailDate(workflow, "P3D.fitDate", issues);
  detailText(workflow, "P3D.fitApprovedBy", issues);
  const approved = workflow.details["P3D.approvedCadVersion"];
  if (!hasText(approved) || !workflow.cadVersions.includes(approved))
    issues.push(
      "P3D: versão do CAD aprovada deve pertencer ao histórico do projeto."
    );
  if (workflow.cadVersions.length && approved !== workflow.cadVersions.at(-1))
    issues.push(
      "P3D: nova revisão do CAD exige novo protótipo e novo fit test; a versão aprovada deve ser a última."
    );
  return issues;
}

export function validateTaskCompletion(
  workflow: JobWorkflow,
  taskId: string
): string[] {
  try {
    validateServiceCodes(workflow.serviceCodes);
    if (workflow.packageCode)
      validatePackage(workflow.serviceCodes, workflow.packageCode);
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }
  const tasks = buildChecklist(workflow);
  const index = tasks.findIndex(task => task.id === taskId);
  if (index < 0) return ["Tarefa não pertence ao checklist atual do job."];
  const task = tasks[index],
    issues: string[] = [];
  // The two mandatory feasibility evaluations happen before quoting, not after other production categories.
  const earlyEvaluation = task.id === "FAR-01" || task.id === "PDR-01";
  if (!earlyEvaluation) {
    const pending = tasks
      .slice(0, index)
      .filter(previous => !workflow.tasks[previous.id]?.done);
    if (pending.length)
      issues.push(
        `Ordem de execução: conclua primeiro ${pending.map(previous => previous.title).join("; ")}.`
      );
  }
  if (task.photo) issues.push(...photoIssues(workflow, task.photo));
  switch (task.category) {
    case "DET":
      if (task.step === 1)
        detailText(
          workflow,
          "DET.preexistingDamage",
          issues,
          "Danos pré-existentes (ou nenhum)"
        );
      if (task.step === 5) {
        if (workflow.details["DET.testSpotDone"] !== true)
          issues.push(
            "DET: test spot feito é obrigatório antes de expandir a correção."
          );
        detailText(workflow, "DET.compoundPad", issues);
        detailText(workflow, "DET.rotation", issues);
      }
      if (task.step === 8) {
        detailText(workflow, "DET.protectionProduct", issues);
        detailDate(workflow, "DET.protectionDate", issues);
        if (workflow.details["DET.cureRespected"] !== true)
          issues.push("DET: respeite e registre o tempo de cura da proteção.");
      }
      if (task.step === 10) detailText(workflow, "DET.nextMaintenance", issues);
      break;
    case "PDR":
      if (task.step === 1) {
        for (const key of [
          "PDR.panel",
          "PDR.sizeDepth",
          "PDR.access",
          "PDR.feasibility",
        ])
          detailText(workflow, key, issues);
        if (typeof workflow.details["PDR.paintIntact"] !== "boolean")
          issues.push(
            "PDR: registre pintura intacta (sim/não) e decisão de viabilidade."
          );
      }
      if (task.step === 3)
        detailText(workflow, "PDR.removedAccessItems", issues);
      if (task.step === 4) detailText(workflow, "PDR.technique", issues);
      break;
    case "FAR":
      if (task.step === 1) {
        detailText(workflow, "FAR.damageType", issues);
        if (
          typeof workflow.details["FAR.damageType"] === "string" &&
          /intern|trinc|crack/i.test(
            workflow.details["FAR.damageType"] as string
          ) &&
          workflow.details["FAR.expectationAligned"] !== true
        )
          issues.push(
            "FAR: dano interno/trinca não é resolvido pela restauração externa; alinhe a expectativa antes de orçar."
          );
      }
      if (task.step === 4) detailText(workflow, "FAR.grits", issues);
      if (task.step === 6) {
        detailText(workflow, "FAR.protectionProduct", issues);
        detailDate(workflow, "FAR.protectionDate", issues);
        if (workflow.details["FAR.cureRespected"] !== true)
          issues.push("FAR: respeite e registre o tempo de cura da proteção.");
      }
      break;
    case "P3D":
      if (task.step === 1) detailText(workflow, "P3D.functionLoads", issues);
      if (task.step === 2) {
        detailText(workflow, "P3D.feasibility", issues);
        detailText(workflow, "P3D.quoteBreakdown", issues);
        if (
          workflow.serviceCodes.includes("P3D-05") &&
          !["repair", "recreate"].includes(workflow.repairMode)
        )
          issues.push(
            "P3D-05: decida reparar a peça existente ou recriar na viabilidade."
          );
      }
      if (task.step === 4 && !workflow.cadVersions.length)
        issues.push("CAD: salve v1; cada revisão deve ser uma nova versão.");
      if (task.step === 6) issues.push(...fitIssues(workflow));
      if (task.step === 7) {
        if (!workflow.tasks["P3D-06"]?.done)
          issues.push(
            "Impressão final bloqueada: conclua o FIT TEST aprovado primeiro."
          );
        issues.push(...fitIssues(workflow));
        detailText(workflow, "P3D.materialFinal", issues);
      }
      if (task.step === 10) {
        issues.push(...projectFileIssues(workflow));
        if (
          workflow.repairMode !== "repair" ||
          workflow.serviceCodes.some(
            code => code === "P3D-01" || code === "P3D-02"
          )
        ) {
          issues.push(...fitIssues(workflow));
          detailText(workflow, "P3D.materialFinal", issues);
          detailText(workflow, "P3D.printSettings", issues);
        }
      }
      break;
  }
  return [...new Set(issues)];
}

function receivedPaymentCents(payments: Payment[]): number {
  let receivedCents = 0;
  for (const payment of payments) {
    if (!finiteAmount(payment.amount))
      throw new Error("Valor do pagamento deve ser finito e não negativo.");
    receivedCents += toCents(payment.amount);
    if (!Number.isSafeInteger(receivedCents))
      throw new Error("Pagamentos excedem a precisão monetária segura.");
  }
  return receivedCents;
}

/** The payment ledger is the source of receipts; deposit metadata is not a second receipt. */
export function workflowPayment(
  workflow: JobWorkflow,
  payments: Payment[]
): {
  balance: number | null;
  status: "pendente" | "parcial" | "pago";
  received: number;
} {
  const receivedCents = receivedPaymentCents(payments);
  const received = centsToAmount(receivedCents);
  const amount =
    workflow.finalAmount !== null
      ? workflow.finalAmount
      : workflow.quotedAmount;
  if (amount === null)
    return {
      balance: null,
      status: received > 0 ? "parcial" : "pendente",
      received,
    };
  if (!finiteAmount(amount))
    throw new Error(
      "Valor do job deve ser finito e não negativo, ou nulo enquanto não orçado."
    );
  const balanceCents = toCents(amount) - receivedCents;
  return {
    balance: centsToAmount(balanceCents),
    status:
      balanceCents <= 0 ? "pago" : receivedCents > 0 ? "parcial" : "pendente",
    received,
  };
}

function stageIndex(stage: PipelineStage): number {
  return pipeline.findIndex(item => item.id === stage);
}
function stateIssues(
  order: StudioOrder,
  workflow: JobWorkflow,
  target: PipelineStage,
  data?: StudioData
): string[] {
  const issues: string[] = [],
    level = stageIndex(target);
  const requireDate = (value: string, label: string) => {
    if (!validDate(value)) issues.push(`${label}: informe uma data real.`);
  };
  const requireAmount = (value: number | null, label: string) => {
    if (!finiteAmount(value))
      issues.push(
        `${label}: informe explicitamente um valor finito (zero é permitido, nulo não).`
      );
  };
  if (level < 0) return ["Etapa do pipeline inválida."];
  try {
    validateServiceCodes(workflow.serviceCodes);
    if (workflow.packageCode)
      validatePackage(workflow.serviceCodes, workflow.packageCode);
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }
  if (level >= 1) {
    if (!hasText(order.clientId))
      issues.push("Cliente: preenchimento obrigatório.");
    if (!hasText(order.vehicleId))
      issues.push(
        "Veículo: ano, modelo e cor são obrigatórios, inclusive no B2B."
      );
    const client = data?.clients.find(item => item.id === order.clientId);
    const vehicle = data?.vehicles.find(item => item.id === order.vehicleId);
    if (data) {
      if (!client || !hasText(client.name))
        issues.push("Nome do cliente: preenchimento obrigatório.");
      if (!client || (!hasText(client.phone) && !hasText(client.email)))
        issues.push("Contato do cliente: informe telefone ou e-mail.");
      if (!vehicle || vehicle.clientId !== order.clientId)
        issues.push("O veículo deve pertencer ao cliente selecionado.");
      if (
        !vehicle ||
        !Number.isInteger(vehicle.year) ||
        vehicle.year < 1900 ||
        vehicle.year > 2100 ||
        !hasText(vehicle.model) ||
        !hasText(vehicle.color)
      )
        issues.push("Veículo: informe ano, modelo e cor.");
    } else if (
      !hasText(order.clientName) &&
      !hasText(order.clientSnapshot?.name)
    )
      issues.push("Nome do cliente: preenchimento obrigatório.");
  }
  if (level >= 2) {
    issues.push(...photoIssues(workflow, "before"));
    if (!hasText(workflow.problem))
      issues.push("Descrição do problema: preenchimento obrigatório.");
    requireAmount(workflow.quotedAmount, "Valor orçado");
    requireDate(workflow.estimatedDeadline, "Prazo estimado");
    if (
      order.lines.some(
        line => (line as typeof line & { pricePending?: boolean }).pricePending
      )
    )
      issues.push(
        "Preço pendente: preencha manualmente o preço de todos os serviços antes de enviar/aprovar o orçamento."
      );
    for (const task of buildChecklist(workflow).filter(
      task => task.id === "FAR-01" || task.id === "PDR-01"
    )) {
      if (!workflow.tasks[task.id]?.done)
        issues.push(`Avaliação obrigatória antes do orçamento: ${task.title}.`);
      else issues.push(...validateTaskCompletion(workflow, task.id));
    }
  }
  if (level >= 4) {
    if (workflow.depositApplicable) {
      requireAmount(workflow.depositAmount, "Sinal/depósito aplicável");
      requireDate(workflow.depositDate, "Data do sinal/depósito");
      if (finiteAmount(workflow.depositAmount)) {
        try {
          if (
            receivedPaymentCents(order.payments ?? []) <
            toCents(workflow.depositAmount)
          )
            issues.push(
              "Sinal/depósito recebido exige lançamento explícito suficiente no registro de pagamentos."
            );
        } catch (error) {
          issues.push(error instanceof Error ? error.message : String(error));
        }
      }
    }
    requireDate(workflow.entryDate, "Data de entrada");
    requireDate(workflow.promisedDate, "Data prometida de entrega");
    if (
      validDate(workflow.entryDate) &&
      validDate(workflow.promisedDate) &&
      workflow.promisedDate < workflow.entryDate
    )
      issues.push("A promessa de entrega não pode anteceder a entrada.");
  }
  if (level >= 5) {
    requireAmount(
      workflow.materialCost,
      "Custo de material — lançamento obrigatório antes da produção"
    );
    if (workflow.materialCost !== null && workflow.materialCost > 0)
      requireDate(workflow.materialPurchasedOn, "Data da compra de material");
  }
  if (level >= 6) {
    const tasks = buildChecklist(workflow),
      pending = tasks.filter(task => !workflow.tasks[task.id]?.done);
    if (pending.length)
      issues.push(
        `Checklist completo obrigatório: ${pending.map(task => task.title).join("; ")}.`
      );
    for (const task of tasks.filter(task => workflow.tasks[task.id]?.done))
      issues.push(...validateTaskCompletion(workflow, task.id));
    issues.push(...photoIssues(workflow, "after"));
  }
  if (level >= 7) {
    requireAmount(workflow.finalAmount, "Valor final cobrado");
    if (!hasText(workflow.paymentMethod))
      issues.push("Forma de pagamento: preenchimento obrigatório.");
    requireDate(workflow.paymentDate, "Data do pagamento");
    requireDate(workflow.deliveryDate, "Data da entrega");
    if (
      validDate(workflow.entryDate) &&
      validDate(workflow.deliveryDate) &&
      workflow.deliveryDate < workflow.entryDate
    )
      issues.push("A entrega não pode anteceder a entrada.");
    try {
      const payment = workflowPayment(workflow, order.payments ?? []);
      if (payment.balance === null || payment.balance > 0)
        issues.push(
          "Entregue / Pago exige quitação do valor final no registro de pagamentos."
        );
      if (payment.balance !== null && payment.balance < 0)
        issues.push("Pagamentos não podem exceder o valor final cobrado.");
    } catch (error) {
      issues.push(error instanceof Error ? error.message : String(error));
    }
    if (workflow.serviceCodes.includes("P3D-04")) {
      issues.push(
        ...projectFileIssues(
          workflow,
          "P3D B2B: pasta com scan e CAD para entrega de arquivos"
        )
      );
      const approved = workflow.details["P3D.approvedCadVersion"];
      if (!hasText(approved) || !workflow.cadVersions.includes(approved))
        issues.push("P3D B2B: registre a versão do CAD entregue no histórico.");
    }
  }
  if (level >= 8 && typeof workflow.reviewRequested !== "boolean")
    issues.push(
      "Avaliação solicitada: registre explicitamente sim ou não no pós-venda."
    );
  return [...new Set(issues)];
}

export function transitionIssues(
  order: StudioOrder,
  target: PipelineStage,
  data?: StudioData
): string[] {
  const workflow = workflowForOrder(order),
    current = stageIndex(workflow.stage),
    next = stageIndex(target);
  if (current < 0 || next < 0) return ["Etapa do pipeline inválida."];
  // Backwards is allowed. Saving that earlier state still validates completed tasks and resets.
  if (next < current) return [];
  const issues: string[] = [];
  if (next > current + 1)
    issues.push("Avance uma etapa por vez; não pule status do pipeline.");
  // The cumulative state validation prevents a direct jump from bypassing any intervening gate.
  for (let index = current + 1; index <= next; index++)
    issues.push(...stateIssues(order, workflow, pipeline[index].id, data));
  if (next === current)
    issues.push(...stateIssues(order, workflow, target, data));
  return [...new Set(issues)];
}

export function validateWorkflowSave(
  order: StudioOrder,
  data?: StudioData
): void {
  const workflow = (order as StudioOrder & { workflow?: JobWorkflow }).workflow;
  // Legacy orders remain readable/savable without automatic conversion into the official catalog.
  if (!workflow) return;
  const issues: string[] = [];
  if (workflow.version !== 1) issues.push("Versão do workflow inválida.");
  for (const [key, value] of Object.entries({
    quotedAmount: workflow.quotedAmount,
    depositAmount: workflow.depositAmount,
    materialCost: workflow.materialCost,
    hoursWorked: workflow.hoursWorked,
    finalAmount: workflow.finalAmount,
  }))
    if (value !== null && !finiteAmount(value))
      issues.push(
        `${key}: informe valor finito e não negativo, ou deixe nulo.`
      );
  if (typeof workflow.depositApplicable !== "boolean")
    issues.push("Sinal aplicável deve ser sim/não.");
  if (
    workflow.reviewRequested !== null &&
    typeof workflow.reviewRequested !== "boolean"
  )
    issues.push("Avaliação solicitada deve ser sim/não ou nulo.");
  if (!["", "repair", "recreate"].includes(workflow.repairMode))
    issues.push("Decisão de reparo inválida.");
  for (const [key, value] of Object.entries({
    estimatedDeadline: workflow.estimatedDeadline,
    depositDate: workflow.depositDate,
    materialPurchasedOn: workflow.materialPurchasedOn,
    paymentDate: workflow.paymentDate,
    entryDate: workflow.entryDate,
    promisedDate: workflow.promisedDate,
    deliveryDate: workflow.deliveryDate,
  }))
    if (value !== "" && !validDate(value))
      issues.push(`${key}: informe uma data real.`);
  if (
    !Array.isArray(workflow.beforePhotos) ||
    !Array.isArray(workflow.afterPhotos)
  )
    issues.push("Fotos devem ser listas de anexos.");
  else
    for (const [side, photos] of [
      ["antes", workflow.beforePhotos],
      ["depois", workflow.afterPhotos],
    ] as const)
      if (photos.some(photo => !isImage(photo)))
        issues.push(
          `Fotos ${side}: exigem imagem com storagePath e contentType de imagem, não PDF, URL ou placeholder.`
        );
  for (const [key, value] of Object.entries(workflow.details)) {
    if (
      !/^(DET|PDR|FAR|P3D)\./.test(key) ||
      !["string", "boolean"].includes(typeof value)
    )
      issues.push(`Campo específico inválido: ${key}.`);
    const descriptor = Object.values(categoryFields)
      .flat()
      .find(field => field.key === key);
    if (
      descriptor &&
      ((descriptor.type === "boolean" && typeof value !== "boolean") ||
        (descriptor.type !== "boolean" && typeof value !== "string"))
    )
      issues.push(`${descriptor.label}: tipo de campo inválido.`);
    if (descriptor?.type === "date" && value !== "" && !validDate(value))
      issues.push(`${descriptor.label}: informe uma data real.`);
  }
  if (
    !Array.isArray(workflow.cadVersions) ||
    workflow.cadVersions.some(version => !hasText(version)) ||
    new Set(workflow.cadVersions).size !== workflow.cadVersions.length
  )
    issues.push(
      "Histórico CAD: cada revisão deve ter uma versão única, sem sobrescrever."
    );
  const previous = data?.orders.find(item => item.id === order.id);
  const previousWorkflow = (
    previous as (StudioOrder & { workflow?: JobWorkflow }) | undefined
  )?.workflow;
  if (
    previousWorkflow &&
    (!previousWorkflow.cadVersions.every(
      (version, index) => workflow.cadVersions[index] === version
    ) ||
      workflow.cadVersions.length < previousWorkflow.cadVersions.length)
  )
    issues.push(
      "Histórico CAD é append-only: preserve todas as versões existentes na ordem original."
    );
  for (const line of order.lines) {
    const code = (line as typeof line & { serviceCode?: string }).serviceCode;
    if (
      code &&
      (!findService(code) ||
        findService(code)?.type === "Pacote" ||
        !workflow.serviceCodes.includes(code))
    )
      issues.push(
        `Código da linha não pertence aos serviços executáveis do job: ${code}.`
      );
  }
  for (const code of workflow.serviceCodes)
    if (
      !order.lines.some(
        line =>
          (line as typeof line & { serviceCode?: string }).serviceCode === code
      )
    )
      issues.push(
        `Serviço ${code}: adicione uma linha real ao documento; não basta declarar o código no workflow.`
      );
  const tasks = buildChecklist(workflow);
  for (const [id, state] of Object.entries(workflow.tasks)) {
    if (typeof state.done !== "boolean")
      issues.push(`Estado da tarefa inválido: ${id}.`);
    if (state.completedAt && !Number.isFinite(Date.parse(state.completedAt)))
      issues.push(`Data de conclusão da tarefa inválida: ${id}.`);
    if (state.done) {
      if (!tasks.some(task => task.id === id))
        issues.push(`Tarefa concluída fora do checklist atual: ${id}.`);
      else issues.push(...validateTaskCompletion(workflow, id));
    }
  }
  // A rejected fit or a CAD revision invalidates every downstream production task.
  if (
    workflow.serviceCodes.some(
      code =>
        code === "P3D-01" ||
        code === "P3D-02" ||
        (code === "P3D-05" && workflow.repairMode !== "repair")
    )
  ) {
    const revised = Boolean(
      previousWorkflow &&
        workflow.cadVersions.length > previousWorkflow.cadVersions.length
    );
    const resetRequired =
      workflow.details["P3D.fitApproved"] === false ||
      (revised && previousWorkflow?.tasks["P3D-05"]?.done);
    if (
      resetRequired &&
      tasks.some(
        task =>
          task.category === "P3D" &&
          task.step >= 5 &&
          workflow.tasks[task.id]?.done
      )
    )
      issues.push(
        "Fit reprovado / CAD revisado: reabra o CAD, gere nova versão e reinicie protótipo, fit test e tarefas posteriores."
      );
    if (
      previousWorkflow?.details["P3D.fitApproved"] === true &&
      workflow.details["P3D.fitApproved"] === false &&
      workflow.cadVersions.length <= previousWorkflow.cadVersions.length
    )
      issues.push(
        "Fit test reprovado: registre uma nova versão do CAD sem sobrescrever o histórico."
      );
  }
  issues.push(...stateIssues(order, workflow, workflow.stage, data));
  if (issues.length) throw new Error([...new Set(issues)].join("\n"));
}
