import { useMemo, useState } from "react";
import MaterialSelector from "../../components/MaterialSelector";
import type { Attachment } from "../../lib/models";
import { stripDownloadUrlToken } from "../../lib/attachments";
import {
  findService,
  officialServices,
  serviceCategories,
  type ServiceCategory,
} from "../serviceCatalog";
import { addOfficialLines } from "../serviceLines";
import { createWorkflow } from "../jobWorkflow";
import {
  Button,
  ConfirmButton,
  EmptyState,
  Field,
  FormModal,
  Badge,
  PageHeading,
  useAction,
} from "../components/ui";
import { useGestor } from "../store";
import {
  dateLabel,
  makeId,
  services,
  vehicleLabel,
  type Assessment,
  type ServiceType,
  type StudioOrder,
  type Vehicle,
} from "../types";

type AssessmentDraft = Pick<
  Assessment,
  | "id"
  | "serviceType"
  | "serviceCode"
  | "vehicleId"
  | "clientId"
  | "title"
  | "condition"
  | "objective"
  | "limitations"
  | "verdict"
  | "safetyCritical"
>;

type EditorState = {
  draft: AssessmentDraft;
  existingPhotos: Attachment[];
  isNew: boolean;
};

type UnknownRecord = Record<string, unknown>;

const categoryServiceTypes: Record<ServiceCategory, ServiceType> = {
  DET: "detailing",
  PDR: "pdr",
  FAR: "headlights",
  P3D: "engineering",
};
const categories = Object.keys(serviceCategories) as ServiceCategory[];
const categoryRestrictions: Record<ServiceCategory, string> = {
  DET: "Avaliar pintura e danos pré-existentes. Correção exige test spot; coating somente sobre pintura corrigida. Add-ons de trim, engine bay e water spots precedem a proteção. Registrar produto, data e cura.",
  PDR: "Registrar tamanho, profundidade, acesso e pintura intacta. Pintura quebrada exige decisão de viabilidade: touch-up PDR-02 ou o caso não é PDR puro. Orçamento por painel/amassado, com foto sob luz de PDR.",
  FAR: "Dano externo pode ser restaurado. Dano interno ou trinca não é resolvido por restauração externa; alinhar expectativa antes de orçar. Registrar fotos dos dois faróis com mesma distância e luz.",
  P3D: "Registrar função, calor, vibração, sol e carga da peça; material escolhido pela função. Protótipo e fit test aprovado bloqueiam a impressão final. P3D-04 entrega somente arquivos scan/CAD; P3D-05 exige decidir reparar ou recriar.",
};

function categoryForType(
  serviceType: ServiceType
): ServiceCategory | undefined {
  return categories.find(
    category => categoryServiceTypes[category] === serviceType
  );
}

function assessmentServiceLabel(assessment: Assessment): string {
  const service = assessment.serviceCode
    ? findService(assessment.serviceCode)
    : undefined;
  if (service) return `${service.code} — ${service.name}`;
  const category = categoryForType(assessment.serviceType);
  return category
    ? serviceCategories[category]
    : `${services[assessment.serviceType]?.name ?? "Serviço"} (legado)`;
}

function blankDraft(): AssessmentDraft {
  return {
    id: makeId("assessment"),
    serviceType: "detailing",
    serviceCode: "",
    vehicleId: "",
    clientId: "",
    title: "",
    condition: "",
    objective: "",
    limitations: "",
    verdict: "Pendente",
    safetyCritical: false,
  };
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringFrom(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() || fallback : fallback;
}

function numberFrom(value: unknown, fallback = 0): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function escapedHtml(value: unknown): string {
  return String(value ?? "").replace(
    /[&<>"']/g,
    character =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ] ?? character
  );
}

function verdictTone(
  verdict: Assessment["verdict"]
): "gold" | "success" | "warning" | "danger" | "neutral" {
  if (verdict === "Viável") return "success";
  if (verdict === "Não indicado") return "danger";
  if (verdict === "Requer inspeção") return "warning";
  return "neutral";
}

function safeAttachment(attachment: Attachment): Attachment {
  return stripDownloadUrlToken(attachment);
}

function linkedVehicle(
  vehicleId: string,
  vehicles: Vehicle[]
): Vehicle | undefined {
  return vehicles.find(vehicle => vehicle.id === vehicleId);
}

export default function TriagePage() {
  const {
    data,
    settings,
    search,
    setSearch,
    navigate,
    notify,
    save,
    remove,
    saveOrder,
    upload,
    download,
    removeFile,
  } = useGestor();
  const { run, busy, error: actionError } = useAction();
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [materialVehicleId, setMaterialVehicleId] = useState("");
  const selectedService = editor?.draft.serviceCode
    ? findService(editor.draft.serviceCode)
    : undefined;
  const selectedCategory = editor
    ? categoryForType(editor.draft.serviceType)
    : undefined;

  const materialVehicle = useMemo(
    () => linkedVehicle(materialVehicleId, data.vehicles),
    [data.vehicles, materialVehicleId]
  );

  const triages = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return [...data.triages]
      .filter(assessment => {
        if (!query) return true;
        const vehicle = linkedVehicle(assessment.vehicleId, data.vehicles);
        const client = data.clients.find(
          item => item.id === assessment.clientId
        );
        return [
          assessment.title,
          assessment.condition,
          assessment.objective,
          assessment.limitations,
          assessment.verdict,
          assessmentServiceLabel(assessment),
          vehicleLabel(vehicle),
          client?.name ?? "",
        ]
          .join(" ")
          .toLocaleLowerCase()
          .includes(query);
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [data.clients, data.triages, data.vehicles, search]);

  const closeEditor = () => {
    setEditor(null);
    setSelectedPhotos([]);
  };

  const openNewAssessment = () => {
    setSelectedPhotos([]);
    setEditor({ draft: blankDraft(), existingPhotos: [], isNew: true });
  };

  const openAssessment = (assessment: Assessment) => {
    setSelectedPhotos([]);
    setEditor({
      draft: {
        id: assessment.id,
        serviceType: assessment.serviceType,
        serviceCode: assessment.serviceCode ?? "",
        vehicleId: assessment.vehicleId,
        clientId: assessment.clientId,
        title: assessment.title,
        condition: assessment.condition,
        objective: assessment.objective,
        limitations: assessment.limitations,
        verdict: assessment.verdict,
        safetyCritical: assessment.safetyCritical,
      },
      existingPhotos: assessment.photos.map(safeAttachment),
      isNew: false,
    });
  };

  const updateDraft = <K extends keyof AssessmentDraft>(
    key: K,
    value: AssessmentDraft[K]
  ) => {
    setEditor(current =>
      current
        ? {
            ...current,
            draft: { ...current.draft, [key]: value },
          }
        : current
    );
  };

  const selectPhotos = (files: FileList | null) => {
    const allFiles = Array.from(files ?? []);
    const photos = allFiles.filter(file => /\.(?:png|jpe?g)$/i.test(file.name));
    if (photos.length !== allFiles.length) {
      notify(
        "As fotos de avaliação precisam estar no formato PNG ou JPEG.",
        "error"
      );
    }
    setSelectedPhotos(photos);
  };

  const saveAssessment = async () => {
    if (!editor) return;
    const { draft, existingPhotos, isNew } = editor;
    const original = data.triages.find(item => item.id === draft.id);
    const keepsLegacy =
      !isNew &&
      !draft.serviceCode &&
      !original?.serviceCode &&
      original?.serviceType === draft.serviceType;
    const officialService = draft.serviceCode
      ? findService(draft.serviceCode)
      : undefined;
    if (
      !keepsLegacy &&
      (!officialService ||
        officialService.type === "Pacote" ||
        !officialService.category ||
        categoryServiceTypes[officialService.category] !== draft.serviceType)
    ) {
      throw new Error(
        "Selecione uma das quatro categorias e um código oficial compatível antes de salvar."
      );
    }
    const client = data.clients.find(item => item.id === draft.clientId);
    const vehicle = linkedVehicle(draft.vehicleId, data.vehicles);

    if (!client || !vehicle || vehicle.clientId !== client.id) {
      setSelectedPhotos([]);
      throw new Error(
        "Selecione um cliente e um veículo vinculado a esse cliente antes de salvar."
      );
    }
    if (draft.safetyCritical && draft.verdict !== "Requer inspeção") {
      setSelectedPhotos([]);
      throw new Error(
        "Itens marcados como críticos devem permanecer como “Requer inspeção” até a validação técnica apropriada."
      );
    }

    const timestamp = new Date().toISOString();
    const uploaded: Attachment[] = [];
    try {
      for (const photo of selectedPhotos) {
        const attachment = await upload(draft.id, photo, "document");
        uploaded.push(safeAttachment(attachment));
      }

      const { serviceCode, ...fields } = draft;
      const assessment: Assessment = {
        ...fields,
        ...(serviceCode ? { serviceCode } : {}),
        title: draft.title.trim(),
        condition: draft.condition.trim(),
        objective: draft.objective.trim(),
        limitations: draft.limitations.trim(),
        photos: [...existingPhotos.map(safeAttachment), ...uploaded],
        createdAt: isNew
          ? timestamp
          : (data.triages.find(item => item.id === draft.id)?.createdAt ??
            timestamp),
        updatedAt: timestamp,
      };
      await save("triages", assessment);
      setSelectedPhotos([]);
      setEditor(null);
      notify(
        isNew
          ? "Avaliação automotiva registrada."
          : "Avaliação automotiva atualizada.",
        "success"
      );
    } catch (cause) {
      const cleanup = await Promise.allSettled(
        uploaded.map(attachment => removeFile(attachment))
      );
      if (cleanup.some(result => result.status === "rejected"))
        throw new Error(
          "A avaliação não foi salva e alguns anexos enviados não puderam ser removidos. Revise o armazenamento antes de reenviar."
        );
      setSelectedPhotos([]);
      throw cause;
    }
  };

  const deleteAssessment = async (assessment: Assessment) => {
    await remove("triages", assessment.id);
    const removedFiles = await Promise.allSettled(
      (assessment.photos ?? []).map(photo => removeFile(photo))
    );
    if (removedFiles.some(result => result.status === "rejected")) {
      notify(
        "Avaliação removida; uma ou mais fotos não puderam ser apagadas do armazenamento.",
        "info"
      );
    }
  };

  const convertToOrder = async (assessment: Assessment) => {
    const client = data.clients.find(item => item.id === assessment.clientId);
    const vehicle = linkedVehicle(assessment.vehicleId, data.vehicles);
    if (!client || !vehicle) {
      notify(
        "Vincule cliente e veículo válidos à avaliação antes de criar o documento.",
        "error"
      );
      return;
    }

    const service = assessment.serviceCode
      ? findService(assessment.serviceCode)
      : undefined;
    if (
      !service ||
      service.type === "Pacote" ||
      !service.category ||
      categoryServiceTypes[service.category] !== assessment.serviceType
    ) {
      notify(
        "Abra a avaliação e selecione um código oficial antes de criar a estimativa. O registro histórico permanece preservado.",
        "error"
      );
      return;
    }
    if (service.prerequisites.length) {
      notify(
        `Este add-on exige ${service.prerequisites.join(" ou ")} no mesmo job. Crie a estimativa no Comercial escolhendo o serviço principal e este add-on; nenhum serviço é incluído automaticamente.`,
        "error"
      );
      return;
    }
    const lines = addOfficialLines([], service.code);
    const workflow = createWorkflow([service.code]);
    workflow.problem = assessment.condition;
    // Initial evidence does not automatically approve a pipeline stage.
    workflow.beforePhotos = assessment.photos.map(safeAttachment);
    const timestamp = new Date().toISOString();
    const order: StudioOrder = {
      id: makeId("estimate"),
      documentType: "Estimativa",
      currency: settings.currency,
      status: "Rascunho",
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
      title: `${service.name} · ${vehicle.make} ${vehicle.model}`,
      dueDate: "",
      startDate: "",
      materialId: "",
      materialName: "",
      materialGrams: 0,
      notes: [
        `Origem: avaliação ${assessment.id}.`,
        `Serviço oficial: ${service.code} — ${service.name}. Preço e prazo por avaliação, ainda não definidos.`,
        `Condição: ${assessment.condition}`,
        `Objetivo: ${assessment.objective}`,
        `Limites: ${assessment.limitations}`,
        assessment.safetyCritical
          ? "Item marcado como crítico. Este documento não substitui inspeção, teste, montagem ou validação técnica."
          : "Documento comercial baseado em orientação inicial; a execução depende de inspeção e escopo aprovado.",
      ].join("\n"),
      lines,
      total: 0,
      totalCents: 0,
      taxRate: settings.taxRate,
      createdAt: timestamp,
      updatedAt: timestamp,
      vehicleId: vehicle.id,
      serviceType: assessment.serviceType,
      journeyStage: "evaluate",
      workflow,
      scope: assessment.objective,
      constraints: assessment.limitations,
      inspectionNotes: assessment.safetyCritical
        ? "Item marcado como crítico; inspeção e validação técnica são obrigatórias antes de execução."
        : "Avaliação inicial; confirmar condição e escopo antes de executar.",
    };

    let created = false;
    await run(async () => {
      await saveOrder(order);
      created = true;
    }, "Estimativa criada a partir da avaliação.");
    if (created) navigate("estimates");
  };

  const assessmentFromMaterialAnalysis = (
    payload: UnknownRecord
  ): Assessment => {
    const inputs = isRecord(payload.inputs) ? payload.inputs : {};
    const ranking = isRecord(payload.ranking) ? payload.ranking : {};
    const project = stringFrom(
      payload.project,
      "Triagem de material sem projeto"
    );
    const recommendation = stringFrom(
      payload.recommendation,
      "Sem recomendação segura"
    );
    const confidence = numberFrom(payload.confidence);
    const environment = stringFrom(inputs.environment);
    const continuousTemperature = numberFrom(inputs.continuousTemp);
    const peakTemperature = numberFrom(inputs.peakTemp);
    const missing = Array.isArray(ranking.missing)
      ? ranking.missing.filter(
          (item): item is string =>
            typeof item === "string" && Boolean(item.trim())
        )
      : [];
    const timestamp = new Date().toISOString();

    return {
      id: makeId("material-analysis"),
      serviceType: "engineering",
      vehicleId: materialVehicle?.id ?? "",
      clientId: materialVehicle?.clientId ?? "",
      title: `Triagem de material · ${project}`,
      condition:
        [
          environment && `Ambiente: ${environment}`,
          continuousTemperature > 0 &&
            `Temperatura contínua informada: ${continuousTemperature} °C`,
          peakTemperature > 0 && `Pico informado: ${peakTemperature} °C`,
        ]
          .filter(Boolean)
          .join(" · ") ||
        "Condições de aplicação registradas na análise de material.",
      objective: `Orientar a seleção de material para ${project}. Recomendação do seletor: ${recommendation}.`,
      limitations: [
        `Confiança calculada: ${confidence}%.`,
        missing.length
          ? `Dados ainda necessários: ${missing.join(", ")}.`
          : "Dados principais informados ao seletor.",
        "Esta é uma orientação de triagem; não confirma aptidão técnica, segurança, geometria, montagem, processo ou desempenho da peça física.",
      ].join(" "),
      verdict: "Requer inspeção",
      safetyCritical: false,
      photos: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  };

  const saveMaterialAnalysis = async (payload: UnknownRecord) => {
    try {
      await save("triages", assessmentFromMaterialAnalysis(payload));
      notify(
        "Análise de material registrada como avaliação técnica que requer inspeção.",
        "success"
      );
    } catch (cause) {
      notify("Não foi possível salvar a análise de material.", "error");
      throw cause;
    }
  };

  const addMaterialAnalysisToDocument = async (
    payload: UnknownRecord,
    documentId: string
  ) => {
    const document = data.orders.find(order => order.id === documentId);
    if (!document) {
      const issue = new Error(
        "Selecione um orçamento ou invoice existente para receber a análise."
      );
      notify(issue.message, "error");
      throw issue;
    }

    const ranking = isRecord(payload.ranking) ? payload.ranking : {};
    const primary = isRecord(ranking.primary) ? ranking.primary : {};
    const analysisId = stringFrom(payload.id, makeId("material-analysis"));
    const project = stringFrom(payload.project, "Projeto sem nome");
    const recommendation = stringFrom(
      payload.recommendation,
      stringFrom(primary.name, "Sem recomendação segura")
    );
    const score = numberFrom(payload.score, numberFrom(primary.score));
    const confidence = numberFrom(payload.confidence);
    const analysisSummary = `${project} · ${recommendation} · score ${score}/100 · confiança ${confidence}% · análise ${analysisId}`;
    const relatedLine = document.lines.find(line =>
      line.serviceCode?.startsWith("P3D-")
    );
    const nextOrder: StudioOrder = {
      ...document,
      // Technical guidance is evidence, not an extra billable catalog service.
      lines: document.lines.map(line =>
        line.id === relatedLine?.id
          ? {
              ...line,
              triageAnalysisId: analysisId,
              triageRecommendation: recommendation,
              triageScore: score,
              triageConfidence: confidence,
            }
          : line
      ),
      notes: [
        document.notes,
        `Triagem técnica de material vinculada (sem novo serviço ou preço): ${analysisSummary}.`,
        "A recomendação exige validação da aplicação e da peça física antes de qualquer uso crítico.",
      ]
        .filter(Boolean)
        .join("\n"),
      updatedAt: new Date().toISOString(),
    };

    try {
      await saveOrder(nextOrder);
      notify(
        `Triagem de material adicionada ao documento ${document.title || document.id}.`,
        "success"
      );
    } catch (cause) {
      notify("Não foi possível adicionar a análise ao documento.", "error");
      throw cause;
    }
  };

  const printAssessment = (assessment: Assessment) => {
    const vehicle = linkedVehicle(assessment.vehicleId, data.vehicles);
    const client = data.clients.find(item => item.id === assessment.clientId);
    const reportWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!reportWindow) {
      notify(
        "O navegador bloqueou a janela do relatório. Autorize pop-ups e tente novamente.",
        "error"
      );
      return;
    }
    reportWindow.opener = null;
    const rows = [
      ["Serviço", assessmentServiceLabel(assessment)],
      ["Cliente", client?.name || "Não vinculado"],
      ["Veículo", vehicleLabel(vehicle)],
      ["Veredito", assessment.verdict],
      [
        "Item crítico",
        assessment.safetyCritical
          ? "Sim — exige inspeção e validação antes de execução."
          : "Não marcado nesta avaliação.",
      ],
      ["Fotos registradas", `${assessment.photos.length}`],
      ["Data", dateLabel(assessment.createdAt)],
    ]
      .map(
        ([label, value]) =>
          `<dt>${escapedHtml(label)}</dt><dd>${escapedHtml(value)}</dd>`
      )
      .join("");

    reportWindow.document.write(
      `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>Relatório de avaliação — ${escapedHtml(assessment.title)}</title><style>body{margin:0;background:#fff;color:#10211d;font:14px/1.55 Inter,Arial,sans-serif}.sheet{max-width:780px;margin:0 auto;padding:42px}.brand{color:#062c27;font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.title{margin:8px 0 4px;font-size:30px;line-height:1.15}.muted{color:#4f5f5a}.badge{display:inline-block;margin-top:14px;padding:5px 9px;border:1px solid #9f8951;border-radius:999px;color:#513f10;background:#fbf5e5;font-weight:700}h2{margin:28px 0 8px;padding-bottom:6px;border-bottom:1px solid #d9e0dc;font-size:16px}p{white-space:pre-wrap}dl{display:grid;grid-template-columns:150px 1fr;gap:7px 18px;margin:0}dt{color:#4f5f5a;font-weight:700}dd{margin:0}.notice{margin-top:25px;padding:14px;border-left:4px solid #c6a55f;background:#f7f4eb}.footer{margin-top:34px;color:#4f5f5a;font-size:12px}@media print{.sheet{padding:20px}}</style></head><body><main class="sheet"><div class="brand">Reverso Works · Avaliar → Definir → Desenvolver → Executar → Conferir</div><h1 class="title">${escapedHtml(assessment.title)}</h1><div class="muted">Registro ${escapedHtml(assessment.id)}</div><div class="badge">${escapedHtml(assessment.verdict)}</div><h2>Dados da avaliação</h2><dl>${rows}</dl><h2>Condição observada</h2><p>${escapedHtml(assessment.condition || "Não informado")}</p><h2>Objetivo</h2><p>${escapedHtml(assessment.objective || "Não informado")}</p><h2>Limites e condicionantes</h2><p>${escapedHtml(assessment.limitations || "Não informado")}</p><aside class="notice"><strong>Orientação não é validação.</strong> Este relatório registra uma avaliação inicial e seus limites. Não confirma segurança, conformidade, montagem, desempenho, aptidão de componente crítico ou resultado técnico sem inspeção, evidência e validação apropriadas.</aside><p class="footer">${escapedHtml(settings.publicFooter)}</p></main><script>window.print()</script></body></html>`
    );
    reportWindow.document.close();
  };

  return (
    <section className="stack" data-testid="triage-page">
      <PageHeading
        eyebrow="Avaliar"
        title="Triagem automotiva"
        description="Registre condição, objetivo e limites antes de definir o escopo. A orientação inicial não substitui inspeção ou validação técnica."
        action={
          <Button
            type="button"
            variant="primary"
            onClick={openNewAssessment}
            data-testid="triage-new"
          >
            Nova avaliação
          </Button>
        }
      />

      <div className="grid grid-3">
        <article className="card">
          <p className="eyebrow">Método</p>
          <strong>Avaliar antes de orçar</strong>
          <p className="muted">
            Preço por avaliação: valor e prazo são definidos manualmente após
            inspecionar o problema e confirmar o escopo. Sem tabela fixa ou
            preço zero. Uma avaliação não aprova automaticamente o job.
          </p>
        </article>
        <article className="card">
          <p className="eyebrow">Orientação técnica</p>
          <strong>Material e processo são triagem</strong>
          <p className="muted">
            A seleção ajuda a explicitar dados e limites; não atesta segurança,
            ajuste, resistência ou montagem.
          </p>
        </article>
        <article className="card">
          <p className="eyebrow">Itens críticos</p>
          <strong>Exigem inspeção explícita</strong>
          <p className="muted">
            Marcar um item como crítico registra a necessidade de validação; a
            marcação não valida automaticamente o componente.
          </p>
        </article>
      </div>

      <section className="card stack" aria-labelledby="triage-history-title">
        <div className="card-head split">
          <div>
            <p className="eyebrow">Histórico</p>
            <h2 id="triage-history-title">Avaliações registradas</h2>
          </div>
          <Badge tone="neutral">{data.triages.length} no histórico</Badge>
        </div>
        <div className="toolbar">
          <label className="field" htmlFor="triage-search">
            <span>Pesquisar avaliações</span>
            <input
              id="triage-search"
              type="search"
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Cliente, veículo, condição, objetivo ou veredito"
              data-testid="triage-search"
            />
          </label>
        </div>

        {triages.length ? (
          <div className="grid grid-2" data-testid="triage-history">
            {triages.map(assessment => {
              const client = data.clients.find(
                item => item.id === assessment.clientId
              );
              const vehicle = linkedVehicle(
                assessment.vehicleId,
                data.vehicles
              );
              return (
                <article
                  key={assessment.id}
                  className="card card-body stack"
                  style={{ overflowWrap: "anywhere" }}
                >
                  <div className="row wrap">
                    <Badge tone={verdictTone(assessment.verdict)}>
                      {assessment.verdict}
                    </Badge>
                    {assessment.safetyCritical && (
                      <Badge tone="warning">
                        Item crítico — inspeção exigida
                      </Badge>
                    )}
                    {!assessment.serviceCode && (
                      <Badge tone="neutral">Sem código oficial vinculado</Badge>
                    )}
                  </div>
                  <h3>{assessment.title}</h3>
                  <p className="muted">{assessmentServiceLabel(assessment)}</p>
                  <div>
                    <strong>{client?.name || "Cliente não vinculado"}</strong>
                    <p className="muted">{vehicleLabel(vehicle)}</p>
                  </div>
                  <p className="helper">
                    {dateLabel(assessment.createdAt)} ·{" "}
                    {assessment.photos.length} foto(s)
                  </p>
                  <div className="row wrap">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => openAssessment(assessment)}
                      aria-label={`Editar avaliação ${assessment.title}`}
                    >
                      Editar
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => printAssessment(assessment)}
                      aria-label={`Imprimir relatório de ${assessment.title}`}
                    >
                      Relatório
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void convertToOrder(assessment)}
                    >
                      Criar documento
                    </Button>
                    <ConfirmButton
                      label="Remover"
                      variant="danger"
                      confirmation={`Remover a avaliação “${assessment.title}”? Esta ação não pode ser desfeita.`}
                      onConfirm={() =>
                        run(
                          () => deleteAssessment(assessment),
                          "Avaliação removida."
                        )
                      }
                    />
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title={
              data.triages.length
                ? "Nenhuma avaliação encontrada"
                : "Nenhuma avaliação registrada"
            }
            description={
              data.triages.length
                ? "Ajuste a pesquisa para localizar condição, veículo, cliente ou veredito."
                : "Comece registrando o veículo, a condição e os limites da primeira avaliação."
            }
            action={
              <Button
                type="button"
                variant="primary"
                onClick={
                  data.triages.length ? () => setSearch("") : openNewAssessment
                }
              >
                {data.triages.length ? "Limpar pesquisa" : "Nova avaliação"}
              </Button>
            }
          />
        )}
        {actionError && (
          <p className="error-message" role="alert">
            {actionError}
          </p>
        )}
      </section>

      <section
        className="card stack"
        aria-labelledby="material-selector-title"
        data-testid="triage-material-selector"
      >
        <div className="card-head split">
          <div>
            <p className="eyebrow">Triagem técnica de material</p>
            <h2 id="material-selector-title">Orientar material e processo</h2>
          </div>
          <Badge tone="warning">Requer validação física</Badge>
        </div>
        <p className="muted">
          O seletor recebe estoque, impressoras e documentos atuais. Sua
          recomendação é orientação baseada nos dados informados, não aprovação
          automática para aplicação crítica. Vincular a análise adiciona
          evidência técnica às notas do documento, sem novo serviço ou preço.
        </p>
        <Field
          label="Vincular a um veículo (opcional)"
          help="Ao salvar como documento técnico, o vínculo identifica o cliente e veículo da análise. Sem vínculo, o histórico a mantém explicitamente não vinculada."
        >
          <select
            value={materialVehicleId}
            onChange={event => setMaterialVehicleId(event.target.value)}
          >
            <option value="">Sem veículo vinculado</option>
            {data.vehicles.map(vehicle => {
              const owner = data.clients.find(
                client => client.id === vehicle.clientId
              );
              return (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicleLabel(vehicle)} ·{" "}
                  {owner?.name || "Cliente não vinculado"}
                </option>
              );
            })}
          </select>
        </Field>
        <MaterialSelector
          stock={data.materials}
          printers={data.printers}
          documents={data.orders}
          preview={false}
          onSave={saveMaterialAnalysis}
          onAddToDocument={addMaterialAnalysisToDocument}
          onNotice={message => notify(message, "info")}
        />
      </section>

      {editor && (
        <FormModal
          title={
            editor.isNew
              ? "Nova avaliação automotiva"
              : "Editar avaliação automotiva"
          }
          onClose={closeEditor}
          onSubmit={saveAssessment}
          submitLabel={editor.isNew ? "Salvar avaliação" : "Salvar alterações"}
        >
          <div className="stack">
            <p className="muted">
              Fotos são enviadas somente ao salvar. Cancelar não envia arquivos;
              se o salvamento falhar, a seleção local é limpa e os uploads
              concluídos nesta tentativa são removidos.
            </p>
            <div className="form-grid">
              <Field label="Categoria oficial" className="field-full">
                <div
                  className="grid grid-2"
                  role="group"
                  aria-label="Categoria do serviço"
                >
                  {categories.map(category => (
                    <Button
                      key={category}
                      type="button"
                      variant={
                        editor.draft.serviceType ===
                        categoryServiceTypes[category]
                          ? "primary"
                          : "secondary"
                      }
                      aria-pressed={
                        editor.draft.serviceType ===
                        categoryServiceTypes[category]
                      }
                      onClick={() => {
                        if (
                          editor.draft.serviceType ===
                          categoryServiceTypes[category]
                        )
                          return;
                        setEditor(current =>
                          current
                            ? {
                                ...current,
                                draft: {
                                  ...current.draft,
                                  serviceType: categoryServiceTypes[category],
                                  serviceCode: "",
                                },
                              }
                            : current
                        );
                      }}
                      data-testid={`triage-service-${categoryServiceTypes[category]}`}
                      style={{
                        whiteSpace: "normal",
                        textAlign: "left",
                        justifyContent: "flex-start",
                      }}
                    >
                      {category} — {serviceCategories[category]}
                    </Button>
                  ))}
                </div>
              </Field>
              {!editor.isNew && !editor.draft.serviceCode && (
                <p className="helper field-full" role="note">
                  Avaliação histórica:{" "}
                  {assessmentServiceLabel(
                    data.triages.find(item => item.id === editor.draft.id) ?? {
                      ...editor.draft,
                      photos: [],
                      createdAt: "",
                    }
                  )}
                  . O registro original será preservado. Selecione um serviço
                  oficial para criar uma nova estimativa; não há novos serviços
                  livres.
                </p>
              )}
              <Field
                label="Serviço específico (código oficial)"
                className="field-full"
                help="Selecione o serviço desejado para avaliação. Add-ons dependem do serviço base no mesmo job; o vínculo não implica contratação ou preço definido. Pacotes são compostos no Comercial."
              >
                <select
                  id="triage-service-code"
                  data-testid="triage-service-code"
                  value={editor.draft.serviceCode ?? ""}
                  required={
                    editor.isNew ||
                    Boolean(
                      data.triages.find(item => item.id === editor.draft.id)
                        ?.serviceCode
                    ) ||
                    data.triages.find(item => item.id === editor.draft.id)
                      ?.serviceType !== editor.draft.serviceType
                  }
                  disabled={!selectedCategory}
                  onChange={event =>
                    updateDraft("serviceCode", event.target.value)
                  }
                >
                  <option value="">
                    {selectedCategory
                      ? "Selecione o código oficial"
                      : "Escolha uma categoria oficial"}
                  </option>
                  {officialServices
                    .filter(
                      service =>
                        service.category === selectedCategory &&
                        service.type !== "Pacote"
                    )
                    .map(service => (
                      <option key={service.code} value={service.code}>
                        {service.code} — {service.name} ({service.type})
                      </option>
                    ))}
                </select>
              </Field>
              {selectedService && (
                <div
                  className="card card-body stack field-full"
                  data-testid="triage-service-description"
                >
                  <div className="row wrap">
                    <span className="mono">{selectedService.code}</span>
                    <Badge>{selectedService.type}</Badge>
                    <Badge tone="neutral">Por avaliação</Badge>
                  </div>
                  <strong>{selectedService.name}</strong>
                  <p className="muted">{selectedService.description}</p>
                  <p className="helper">
                    <strong>Pré-requisito:</strong>{" "}
                    {selectedService.prerequisites.length
                      ? `${selectedService.prerequisites.map(code => `${code} — ${findService(code)?.name ?? code}`).join(" OU ")} no mesmo job, antes do add-on. Componha serviço principal e add-on no Comercial.`
                      : "Nenhum."}
                  </p>
                </div>
              )}
              {selectedCategory && (
                <p className="helper field-full">
                  <strong>Restrições e avaliação:</strong>{" "}
                  {categoryRestrictions[selectedCategory]}
                </p>
              )}
              <p className="helper field-full">
                Fora do catálogo: PPF, pintura completa, mecânica e eletrônica
                automotiva (dashcam, CarPlay, painel digital). Não são opções
                para novas avaliações.
              </p>
              <Field label="Cliente">
                <select
                  required
                  value={editor.draft.clientId}
                  onChange={event => {
                    const clientId = event.target.value;
                    updateDraft("clientId", clientId);
                    const currentVehicle = linkedVehicle(
                      editor.draft.vehicleId,
                      data.vehicles
                    );
                    if (currentVehicle && currentVehicle.clientId !== clientId)
                      updateDraft("vehicleId", "");
                  }}
                >
                  <option value="">Selecione o cliente</option>
                  {data.clients.map(client => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Veículo">
                <select
                  required
                  value={editor.draft.vehicleId}
                  onChange={event => {
                    const vehicleId = event.target.value;
                    const vehicle = linkedVehicle(vehicleId, data.vehicles);
                    updateDraft("vehicleId", vehicleId);
                    if (vehicle) updateDraft("clientId", vehicle.clientId);
                  }}
                  disabled={!editor.draft.clientId}
                >
                  <option value="">Selecione o veículo</option>
                  {data.vehicles
                    .filter(
                      vehicle => vehicle.clientId === editor.draft.clientId
                    )
                    .map(vehicle => (
                      <option key={vehicle.id} value={vehicle.id}>
                        {vehicleLabel(vehicle)}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Título da avaliação" className="field-full">
                <input
                  required
                  value={editor.draft.title}
                  onChange={event => updateDraft("title", event.target.value)}
                  placeholder="Ex.: Neblina interna e lente opaca — lado direito"
                />
              </Field>
              <Field label="Condição observada" className="field-full">
                <textarea
                  required
                  value={editor.draft.condition}
                  onChange={event =>
                    updateDraft("condition", event.target.value)
                  }
                  placeholder="Descreva sinais, danos, acesso, montagem e o que foi observado."
                />
              </Field>
              <Field label="Objetivo do cliente" className="field-full">
                <textarea
                  required
                  value={editor.draft.objective}
                  onChange={event =>
                    updateDraft("objective", event.target.value)
                  }
                  placeholder="Resultado pretendido, prioridade e uso esperado."
                />
              </Field>
              <Field
                label="Limites e condicionantes"
                className="field-full"
                help={
                  selectedCategory
                    ? categoryRestrictions[selectedCategory]
                    : "Registro legado: preserve os limites técnicos existentes ou selecione uma categoria oficial para atualizar o escopo."
                }
              >
                <textarea
                  required
                  value={editor.draft.limitations}
                  onChange={event =>
                    updateDraft("limitations", event.target.value)
                  }
                  placeholder="Premissas, peças indisponíveis, incertezas, riscos e o que depende de inspeção."
                />
              </Field>
              <Field label="Veredito">
                <select
                  required
                  value={editor.draft.verdict}
                  onChange={event =>
                    updateDraft(
                      "verdict",
                      event.target.value as Assessment["verdict"]
                    )
                  }
                >
                  <option value="Pendente">Pendente</option>
                  <option value="Viável">Viável</option>
                  <option value="Não indicado">Não indicado</option>
                  <option value="Requer inspeção">Requer inspeção</option>
                </select>
              </Field>
              <Field
                label="Classificação de criticidade"
                help="Esta marcação apenas registra que o item requer tratamento adicional; não é uma validação de segurança."
              >
                <label className="row">
                  <input
                    type="checkbox"
                    checked={editor.draft.safetyCritical}
                    onChange={event => {
                      updateDraft("safetyCritical", event.target.checked);
                      if (event.target.checked)
                        updateDraft("verdict", "Requer inspeção");
                    }}
                  />
                  Item potencialmente crítico para segurança
                </label>
              </Field>
              <Field
                label="Adicionar fotos"
                className="field-full"
                help="Imagens de condição ajudam a triagem, mas não são evidência de aptidão técnica."
              >
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  multiple
                  onChange={event => {
                    selectPhotos(event.target.files);
                    event.currentTarget.value = "";
                  }}
                />
              </Field>
            </div>

            {(editor.existingPhotos.length > 0 ||
              selectedPhotos.length > 0) && (
              <section className="stack" aria-label="Fotos da avaliação">
                <div className="split">
                  <strong>Fotos</strong>
                  {selectedPhotos.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setSelectedPhotos([])}
                    >
                      Limpar seleção
                    </Button>
                  )}
                </div>
                <ul className="list">
                  {editor.existingPhotos.map((photo, index) => (
                    <li
                      key={`${photo.storagePath ?? photo.name}-${index}`}
                      className="list-row"
                    >
                      <span>{photo.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => void run(() => download(photo))}
                      >
                        Baixar
                      </Button>
                    </li>
                  ))}
                  {selectedPhotos.map((photo, index) => (
                    <li
                      key={`${photo.name}-${photo.lastModified}-${index}`}
                      className="list-row"
                    >
                      <span>
                        {photo.name}{" "}
                        <span className="muted">(será enviada ao salvar)</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {editor.draft.safetyCritical && (
              <p className="error-message" role="note">
                Item marcado como potencialmente crítico: mantenha o veredito
                como “Requer inspeção” até que haja inspeção e validação técnica
                apropriadas. A marcação não atesta segurança.
              </p>
            )}
          </div>
        </FormModal>
      )}
    </section>
  );
}
