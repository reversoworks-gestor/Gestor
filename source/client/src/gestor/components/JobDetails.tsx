import { useId, useRef, useState, type FormEvent } from "react";
import type { Attachment, Payment } from "../../lib/models";
import { centsToAmount, toCents } from "../../lib/finance";
import { Badge, Button, DateInput, Field, Modal } from "./ui";
import JobChecklist from "./JobChecklist";
import {
  buildChecklist,
  categoryFields,
  pipeline,
  transitionIssues,
  validateWorkflowSave,
  workflowForOrder,
  workflowPayment,
  type JobWorkflow,
  type PipelineStage,
} from "../jobWorkflow";
import {
  categoryForCodes,
  findService,
  serviceCategories,
} from "../serviceCatalog";
import { useGestor } from "../store";
import {
  dateLabel,
  makeId,
  money,
  vehicleLabel,
  type StudioOrder,
} from "../types";
import "../processStyles.css";

type PendingFile = {
  id: string;
  file: File;
  group: "before" | "after" | "files";
};
const moneyFields = [
  ["quotedAmount", "Valor orçado"],
  ["depositAmount", "Sinal recebido"],
  ["materialCost", "Custo de material"],
  ["hoursWorked", "Horas trabalhadas"],
  ["finalAmount", "Valor final cobrado"],
] as const;
const dateFields = [
  ["depositDate", "Data do sinal"],
  ["materialPurchasedOn", "Data da compra de material"],
  ["entryDate", "Data de entrada"],
  ["promisedDate", "Entrega prometida"],
  ["deliveryDate", "Data da entrega"],
  ["paymentDate", "Data do pagamento"],
] as const;
const attachmentKey = (file: Attachment) =>
  file.storagePath || file.id || `${file.name}-${file.uploadedAt ?? ""}`;
export function appendAttachments(existing: Attachment[], added: Attachment[]) {
  const keys = new Set(existing.map(attachmentKey));
  return [
    ...existing,
    ...added.filter(file => {
      const key = attachmentKey(file);
      if (keys.has(key)) return false;
      keys.add(key);
      return true;
    }),
  ];
}
function resetFitDetails(details: JobWorkflow["details"], rejected = false) {
  const result = Object.fromEntries(
    Object.entries(details).filter(
      ([key]) =>
        !(/^P3D\./.test(key) && /fit|cad.*approv|approv.*cad/i.test(key))
    )
  );
  if (rejected) result["P3D.fitApproved"] = false;
  return result;
}
/** Reopening execution never rewrites payments or historical document prices. */
export function resetWorkflowForStage(
  workflow: JobWorkflow,
  target: PipelineStage
): JobWorkflow {
  const from = pipeline.findIndex(stage => stage.id === workflow.stage);
  const to = pipeline.findIndex(stage => stage.id === target);
  if (to >= from) return { ...workflow, stage: target };
  const resetExecution =
    to <= pipeline.findIndex(stage => stage.id === "production");
  const preserveEvaluation =
    to >= pipeline.findIndex(stage => stage.id === "quote");
  return {
    ...workflow,
    stage: target,
    tasks: resetExecution
      ? Object.fromEntries(
          Object.keys(workflow.tasks).map(id => [
            id,
            preserveEvaluation && ["FAR-01", "PDR-01"].includes(id)
              ? { ...workflow.tasks[id] }
              : { done: false },
          ])
        )
      : { ...workflow.tasks },
    details: resetExecution
      ? resetFitDetails(workflow.details)
      : { ...workflow.details },
    afterPhotos: resetExecution ? [] : [...workflow.afterPhotos],
    deliveryDate:
      to < pipeline.findIndex(stage => stage.id === "delivered")
        ? ""
        : workflow.deliveryDate,
    reviewRequested:
      to < pipeline.findIndex(stage => stage.id === "aftercare")
        ? null
        : workflow.reviewRequested,
  };
}

export default function JobDetails({
  order,
  onClose,
}: {
  order: StudioOrder;
  onClose: () => void;
}) {
  const ctx = useGestor();
  const formId = useId();
  const baseWorkflow = useRef(JSON.stringify(order.workflow));
  const [draft, setDraft] = useState<JobWorkflow>(() =>
    structuredClone(workflowForOrder(order))
  );
  const official = Boolean(order.workflow);
  const [target, setTarget] = useState<PipelineStage>(draft.stage);
  const [busy, setBusy] = useState(false);
  const [issues, setIssues] = useState<string[]>([]);
  const [saved, setSaved] = useState("");
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [version, setVersion] = useState("");
  const [pendingPayments, setPendingPayments] = useState<Payment[]>([]);
  const [paymentAmount, setPaymentAmount] = useState("");
  const owner = ctx.owner;
  const readOnly = !owner || busy || !official;
  const currency = order.currency ?? ctx.settings.currency;
  const payments = [...(order.payments ?? []), ...pendingPayments];
  let payment: ReturnType<typeof workflowPayment> | null = null;
  try {
    payment = workflowPayment(draft, payments);
  } catch {
    /* Invalid drafts stay editable and are rejected on save. */
  }
  const categories = categoryForCodes(draft.serviceCodes);
  const vehicle = ctx.data.vehicles.find(item => item.id === order.vehicleId);
  const client = ctx.data.clients.find(item => item.id === order.clientId);
  const nextStage =
    pipeline[pipeline.findIndex(stage => stage.id === draft.stage) + 1];
  const currentOrder = { ...order, workflow: draft, payments };
  const targetIssues =
    official && target !== draft.stage
      ? transitionIssues(currentOrder, target, ctx.data)
      : [];
  const isB2B =
    draft.serviceCodes.includes("P3D-04") &&
    draft.serviceCodes.filter(code => code.startsWith("P3D-")).length === 1;
  const isRepair = draft.serviceCodes.includes("P3D-05");
  const patch = (values: Partial<JobWorkflow>) => {
    setDraft(current => ({ ...current, ...values }));
    setSaved("");
  };

  function addFiles(files: FileList | null, group: PendingFile["group"]) {
    if (!files || !owner) return;
    const selected = Array.from(files);
    if (
      group !== "files" &&
      selected.some(file => !["image/png", "image/jpeg"].includes(file.type))
    ) {
      setIssues([
        "Fotos antes/depois precisam ser imagens PNG ou JPEG reais. Converta HEIC antes de enviar.",
      ]);
      return;
    }
    if (selected.some(file => !file.size || file.size > 15 * 1024 * 1024)) {
      setIssues(["Cada arquivo deve conter dados e ter no máximo 15 MB."]);
      return;
    }
    setPendingFiles(current => [
      ...current,
      ...selected.map(file => ({ id: makeId("pending"), file, group })),
    ]);
    setSaved("");
  }
  function appendVersion(rejected = false) {
    const name = version.trim();
    if (!name || draft.cadVersions.includes(name)) {
      setIssues([
        "Informe uma nova versão CAD única. Versões anteriores nunca são sobrescritas.",
      ]);
      return;
    }
    const tasks = { ...draft.tasks };
    for (const task of buildChecklist(draft))
      if (task.category === "P3D" && task.step >= 4)
        tasks[task.id] = { done: false };
    const stage =
      pipeline.findIndex(item => item.id === draft.stage) >
      pipeline.findIndex(item => item.id === "production")
        ? "production"
        : draft.stage;
    patch({
      cadVersions: [...draft.cadVersions, name],
      tasks,
      details: resetFitDetails(draft.details, rejected),
      afterPhotos: [],
      stage,
      deliveryDate: "",
      reviewRequested: null,
    });
    setTarget(stage);
    setVersion("");
    setIssues([
      rejected
        ? "Fit test reprovado. Retorno à tarefa CAD (etapa 4) com nova versão; protótipo, fit test, impressão final e etapas posteriores foram reabertos."
        : "Nova versão anexada ao histórico. Execute o CAD, protótipo e um novo fit test antes da impressão final. Evidências antigas continuam nos anexos históricos.",
    ]);
  }
  function registerPayment(deposit = false) {
    const amount = deposit
      ? draft.depositAmount
      : paymentAmount.trim()
        ? Number(paymentAmount)
        : null;
    const date = deposit ? draft.depositDate : draft.paymentDate;
    if (
      amount === null ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      !date ||
      !draft.paymentMethod.trim()
    ) {
      setIssues([
        "Para registrar recebimento, informe valor positivo manualmente, forma de pagamento e data.",
      ]);
      return;
    }
    if (
      deposit &&
      payments.some(
        existing =>
          toCents(existing.amount) === toCents(amount) && existing.date === date
      )
    ) {
      setIssues([
        "O sinal já aparece no histórico de pagamentos com este valor e data. Não será contado duas vezes.",
      ]);
      return;
    }
    if (
      deposit &&
      payments.some(existing => existing.id === `deposit-${order.id}`)
    ) {
      setIssues([
        "Este job já tem um sinal registrado no histórico. Revise o pagamento existente em vez de duplicá-lo.",
      ]);
      return;
    }
    setPendingPayments(current => [
      ...current,
      {
        id: deposit ? `deposit-${order.id}` : makeId("payment"),
        amount: centsToAmount(toCents(amount)),
        amountCents: toCents(amount),
        date,
        method: draft.paymentMethod.trim(),
      },
    ]);
    setPaymentAmount("");
    setIssues([]);
    setSaved("");
  }
  async function download(file: Attachment) {
    try {
      await ctx.download(file);
    } catch (error) {
      setIssues([
        error instanceof Error
          ? error.message
          : "Não foi possível baixar o anexo.",
      ]);
    }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!owner || !official || busy) return;
    if (JSON.stringify(order.workflow) !== baseWorkflow.current) {
      setIssues([
        "Este job mudou enquanto o formulário estava aberto. Feche e reabra os detalhes para carregar os dados atuais; seu rascunho não sobrescreverá a outra alteração.",
      ]);
      return;
    }
    setBusy(true);
    setIssues([]);
    setSaved("");
    const uploaded: Attachment[] = [];
    let persisted = false;
    try {
      let workflow = structuredClone(draft);
      let attachments = [...(order.attachments ?? [])];
      for (const pending of pendingFiles) {
        const file = await ctx.upload(order.id, pending.file);
        uploaded.push(file);
        attachments = appendAttachments(attachments, [file]);
        if (pending.group === "before") workflow.beforePhotos.push(file);
        if (pending.group === "after") workflow.afterPhotos.push(file);
      }
      // Generic attachment references protect evidence in shared-file cleanup and archives.
      attachments = appendAttachments(attachments, [
        ...workflow.beforePhotos,
        ...workflow.afterPhotos,
      ]);
      const candidate: StudioOrder = {
        ...order,
        workflow,
        attachments,
        payments,
      };
      if (target !== workflow.stage) {
        const blockers = transitionIssues(candidate, target, ctx.data);
        if (blockers.length) {
          setIssues(blockers);
          throw new Error(blockers.join("\n"));
        }
        workflow = resetWorkflowForStage(workflow, target);
        candidate.workflow = workflow;
      }
      validateWorkflowSave(candidate, ctx.data);
      await ctx.saveOrder(candidate);
      persisted = true;
      baseWorkflow.current = JSON.stringify(workflow);
      setDraft(workflow);
      setTarget(workflow.stage);
      setPendingFiles([]);
      setPendingPayments([]);
      setSaved(
        "Job salvo. Documentos comerciais e pagamentos anteriores foram preservados."
      );
    } catch (error) {
      setIssues(
        error instanceof Error
          ? error.message.split("\n")
          : ["Não foi possível salvar o job. Tente novamente."]
      );
      if (!persisted) {
        const cleanup = await Promise.allSettled(
          uploaded.map(file => ctx.removeFile(file))
        );
        if (cleanup.some(result => result.status === "rejected"))
          setIssues(current => [
            ...current,
            "Falha ao limpar um upload não salvo. Informe o responsável para verificar o armazenamento.",
          ]);
      }
    } finally {
      setBusy(false);
    }
  }
  function attachmentSection(
    group: PendingFile["group"],
    title: string,
    files: Attachment[]
  ) {
    return (
      <section className="process-section stack">
        <h3>{title}</h3>
        <p className="helper">
          {group === "files"
            ? "Arquivos de entrega e projeto: PDF ou STL (até 15 MB). Baixe pelo armazenamento existente. Versões CAD são registradas separadamente, sem sobrescrever."
            : "PNG/JPEG até 15 MB. Evidências reais; o upload acontece somente ao salvar o job."}
        </p>
        <ul className="process-attachments">
          {files.map((file, index) => (
            <li key={`${attachmentKey(file)}-${index}`}>
              <span>
                <strong>{file.name}</strong>
                {file.uploadedAt && (
                  <small className="helper">{dateLabel(file.uploadedAt)}</small>
                )}
              </span>
              <Button
                onClick={() => void download(file)}
                disabled={busy}
                aria-label={`Baixar ${file.name}`}
              >
                Baixar
              </Button>
            </li>
          ))}
        </ul>
        {!files.length && <p className="muted">Nenhum anexo registrado.</p>}
        {pendingFiles
          .filter(file => file.group === group)
          .map(pending => (
            <div key={pending.id} className="process-pending-file">
              <span>
                {pending.file.name}
                <small className="helper">Selecionado · ainda não salvo</small>
              </span>
              <Button
                disabled={busy}
                onClick={() =>
                  setPendingFiles(current =>
                    current.filter(file => file.id !== pending.id)
                  )
                }
                aria-label={`Remover seleção ${pending.file.name}`}
              >
                Remover
              </Button>
            </div>
          ))}
        {official && owner && (
          <Field
            label={
              group === "files"
                ? "Anexar arquivo de entrega / projeto"
                : `Anexar foto ${group === "before" ? "antes" : "depois"}`
            }
          >
            <input
              type="file"
              accept={group === "files" ? ".pdf,.stl" : "image/png,image/jpeg"}
              multiple
              disabled={busy}
              onChange={event => {
                addFiles(event.target.files, group);
                event.target.value = "";
              }}
            />
          </Field>
        )}
      </section>
    );
  }

  return (
    <Modal
      title={`Job · ${order.title || order.id}`}
      onClose={() => {
        if (!busy) onClose();
      }}
      footer={
        <div className="process-modal-actions">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Fechar
          </Button>
          {owner && official && (
            <Button
              type="submit"
              form={formId}
              variant="primary"
              disabled={busy}
            >
              {busy
                ? "Salvando…"
                : target === draft.stage
                  ? "Salvar job"
                  : "Salvar e alterar etapa"}
            </Button>
          )}
        </div>
      }
    >
      <form
        id={formId}
        className="stack process-details"
        onSubmit={save}
        aria-busy={busy}
      >
        <div className="process-context">
          <div>
            <p className="eyebrow">
              {order.documentType} · {order.id}
            </p>
            <h3>
              {client?.name || order.clientName || "Cliente não informado"}
            </h3>
            <p>
              {client?.phone ||
                client?.email ||
                order.clientSnapshot?.phone ||
                order.clientSnapshot?.email ||
                "Contato não informado"}
            </p>
          </div>
          <div>
            <p>{vehicleLabel(vehicle)}</p>
            <p className="muted">Cor: {vehicle?.color || "não informada"}</p>
          </div>
          <Badge tone={official ? "gold" : "warning"}>
            {official
              ? pipeline.find(stage => stage.id === draft.stage)?.name
              : "Legado · etapa inferida"}
          </Badge>
        </div>
        {!owner && (
          <p className="process-note">
            Acesso consultivo. Somente o responsável pode salvar, executar
            tarefas ou enviar anexos.
          </p>
        )}
        {issues.length > 0 && (
          <div className="process-feedback error-message" role="alert">
            <strong>Verifique antes de continuar</strong>
            <ul>
              {issues.map((issue, index) => (
                <li key={index}>{issue}</li>
              ))}
            </ul>
          </div>
        )}
        {saved && (
          <p className="process-note" role="status">
            {saved}
          </p>
        )}
        {!official && (
          <section className="process-section stack">
            <h3>Documento legado · somente consulta</h3>
            <p>
              Etapa inferida apenas para consulta. Checklist, preços e
              evidências oficiais não são presumidos a partir dos dados antigos.
              Este documento não será migrado nem terá suas linhas, valores ou
              pagamentos reescritos.
            </p>
            <div className="process-form-grid">
              <div className="key-value">
                <span>Status histórico</span>
                <strong>
                  {order.status} ·{" "}
                  {order.journeyStage ?? order.productionStage ?? "sem etapa"}
                </strong>
              </div>
              <div className="key-value">
                <span>Total do documento legado</span>
                <strong>{money(order.total, currency)}</strong>
              </div>
            </div>
            {owner && (
              <Button
                onClick={() => {
                  onClose();
                  ctx.navigate("estimates");
                }}
              >
                Criar novo documento com serviços oficiais
              </Button>
            )}
            <p className="helper">
              O novo job começa como Lead e utiliza serviços do catálogo
              oficial. O histórico deste registro permanece disponível.
            </p>
          </section>
        )}
        {official && (
          <>
            <section className="process-section stack">
              <h3>Etapa e portões</h3>
              <Field
                label="Etapa desejada"
                help="Não permite saltar portões. Ao retroceder até a produção, tarefas posteriores e evidências desta execução são reabertas; anexos históricos e pagamentos são preservados."
              >
                <select
                  data-testid={`production-stage-${order.id}`}
                  disabled={readOnly}
                  value={target}
                  onChange={event => {
                    setTarget(event.target.value as PipelineStage);
                    setSaved("");
                  }}
                >
                  {pipeline.map((stage, index) => (
                    <option value={stage.id} key={stage.id}>
                      {index + 1}. {stage.name}
                    </option>
                  ))}
                </select>
              </Field>
              {targetIssues.length > 0 && (
                <div className="process-feedback" role="status">
                  <strong>
                    Portões para{" "}
                    {pipeline.find(stage => stage.id === target)?.name}
                  </strong>
                  <ul>
                    {targetIssues.map((issue, index) => (
                      <li key={index}>{issue}</li>
                    ))}
                  </ul>
                  {pendingFiles.length > 0 && (
                    <p>
                      Fotos selecionadas serão validadas após o upload ao
                      salvar.
                    </p>
                  )}
                </div>
              )}
              {nextStage && target === draft.stage && (
                <Button
                  disabled={readOnly}
                  onClick={() => setTarget(nextStage.id)}
                >
                  Preparar próxima etapa · {nextStage.name}
                </Button>
              )}
            </section>
            <section className="process-section stack">
              <h3>Escopo oficial</h3>
              {draft.packageCode && (
                <Badge tone="gold">
                  {draft.packageCode} · {findService(draft.packageCode)?.name}
                </Badge>
              )}
              <ul className="process-service-list">
                {draft.serviceCodes.map(code => (
                  <li key={code}>
                    <strong className="mono">{code}</strong> ·{" "}
                    {findService(code)?.name ?? "Código desconhecido"}
                  </li>
                ))}
              </ul>
              <p className="helper">
                Serviços e preços por linha são editados em Estimativas /
                Invoices. Pacotes seguem a ordem oficial automaticamente.
              </p>
              <Field label="Descrição do problema">
                <textarea
                  rows={3}
                  disabled={readOnly}
                  value={draft.problem}
                  onChange={event => patch({ problem: event.target.value })}
                />
              </Field>
            </section>
            <section className="process-section stack">
              <h3>Financeiro do job · {currency}</h3>
              <p className="helper">
                Campos vazios são nulos, nunca preços sugeridos. O valor
                orçado/final operacional não reescreve silenciosamente totais,
                impostos ou linhas do documento. Antes de emitir ou aprovar,
                preencha cada preço em Estimativas / Invoices.
              </p>
              {order.lines.some(line => line.pricePending) && (
                <p className="process-note">
                  Há serviços com preço por linha ainda vazio. O orçamento
                  enviado fica bloqueado enquanto esses valores não forem
                  preenchidos explicitamente no documento comercial.
                </p>
              )}
              <Button
                disabled={busy}
                onClick={() => {
                  onClose();
                  ctx.navigate(
                    order.documentType === "Invoice" ? "invoices" : "estimates"
                  );
                }}
              >
                Fechar sem salvar e editar preços do documento
              </Button>
              <div className="process-form-grid">
                {moneyFields.map(([key, label]) => (
                  <Field
                    key={key}
                    label={label}
                    help={
                      key === "materialCost"
                        ? "Lançar na compra; obrigatório antes da produção. Se não houve custo, registre 0 explicitamente e a data."
                        : key === "finalAmount"
                          ? "Valor total final do job, não apenas a parcela restante."
                          : key === "quotedAmount"
                            ? "Derivado dos preços manuais por linha e impostos no documento comercial. Edite em Estimativas / Invoices."
                            : undefined
                    }
                  >
                    <input
                      type="number"
                      min="0"
                      step={key === "hoursWorked" ? "0.1" : "0.01"}
                      inputMode="decimal"
                      disabled={readOnly}
                      readOnly={key === "quotedAmount"}
                      value={draft[key] ?? ""}
                      placeholder="Não definido"
                      onChange={event =>
                        patch({
                          [key]:
                            event.target.value === ""
                              ? null
                              : Number(event.target.value),
                        })
                      }
                    />
                  </Field>
                ))}
              </div>
              <Field label="Sinal / depósito aplicável">
                <select
                  disabled={readOnly}
                  value={draft.depositApplicable ? "yes" : "no"}
                  onChange={event =>
                    patch({ depositApplicable: event.target.value === "yes" })
                  }
                >
                  <option value="no">Não se aplica</option>
                  <option value="yes">Sim · informar valor e data</option>
                </select>
              </Field>
              <Field label="Prazo estimado do orçamento">
                <DateInput
                  disabled={readOnly}
                  value={draft.estimatedDeadline}
                  onChange={event =>
                    patch({ estimatedDeadline: event.target.value })
                  }
                />
              </Field>
              <Field label="Forma de pagamento">
                <input
                  disabled={readOnly}
                  value={draft.paymentMethod}
                  onChange={event =>
                    patch({ paymentMethod: event.target.value })
                  }
                  placeholder="Informe o método utilizado"
                />
              </Field>
              {payment ? (
                <div className="process-job-facts">
                  <p>
                    <span>Recebido (sem duplicar sinal)</span>
                    <strong>{money(payment.received, currency)}</strong>
                  </p>
                  <p>
                    <span>Saldo calculado</span>
                    <strong>
                      {payment.balance === null
                        ? "Não definido"
                        : money(payment.balance, currency)}
                    </strong>
                  </p>
                  <p>
                    <span>Status calculado</span>
                    <Badge
                      tone={payment.status === "pago" ? "success" : "warning"}
                    >
                      {payment.status}
                    </Badge>
                  </p>
                </div>
              ) : (
                <p className="error-message" role="status">
                  Cálculo pendente: corrija os valores inválidos antes de
                  salvar.
                </p>
              )}
              <details className="process-disclosure">
                <summary>
                  Histórico e registro de recebimentos ({payments.length})
                </summary>
                <div className="stack">
                  <p className="helper">
                    Pagamentos anteriores são preservados. Um sinal com mesmo
                    valor e data já registrado não é lançado novamente; o saldo
                    usa o núcleo financeiro oficial.
                  </p>
                  <ul className="process-payment-list">
                    {payments.map(item => (
                      <li key={item.id}>
                        <span>
                          {dateLabel(item.date)} · {item.method}
                        </span>
                        <strong>{money(item.amount, currency)}</strong>
                        {pendingPayments.some(
                          pending => pending.id === item.id
                        ) && (
                          <Button
                            disabled={busy}
                            onClick={() =>
                              setPendingPayments(current =>
                                current.filter(
                                  pending => pending.id !== item.id
                                )
                              )
                            }
                          >
                            Cancelar novo recebimento
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                  {owner && (
                    <>
                      <Field
                        label="Valor deste recebimento"
                        help="Informe a parcela recebida manualmente. Não preenche saldo automaticamente."
                      >
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          inputMode="decimal"
                          disabled={readOnly}
                          value={paymentAmount}
                          onChange={event =>
                            setPaymentAmount(event.target.value)
                          }
                          placeholder="Não definido"
                        />
                      </Field>
                      <div className="row wrap">
                        <Button
                          disabled={readOnly}
                          onClick={() => registerPayment()}
                        >
                          Registrar recebimento ao salvar
                        </Button>
                        {draft.depositApplicable && (
                          <Button
                            disabled={readOnly}
                            onClick={() => registerPayment(true)}
                          >
                            Registrar sinal no histórico
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </details>
            </section>
            <section className="process-section stack">
              <h3>Datas e pós-venda</h3>
              <div className="process-form-grid">
                {dateFields.map(([key, label]) => (
                  <Field key={key} label={label}>
                    <DateInput
                      disabled={readOnly}
                      value={draft[key]}
                      onChange={event => patch({ [key]: event.target.value })}
                    />
                  </Field>
                ))}
              </div>
              <Field label="Avaliação solicitada ao cliente">
                <select
                  disabled={readOnly}
                  value={
                    draft.reviewRequested === null
                      ? ""
                      : draft.reviewRequested
                        ? "yes"
                        : "no"
                  }
                  onChange={event =>
                    patch({
                      reviewRequested:
                        event.target.value === ""
                          ? null
                          : event.target.value === "yes",
                    })
                  }
                >
                  <option value="">Não registrado</option>
                  <option value="yes">Sim</option>
                  <option value="no">Não</option>
                </select>
              </Field>
            </section>
            {categories.map(category => (
              <section className="process-section stack" key={category}>
                <h3>
                  {category} · {serviceCategories[category]}
                </h3>
                {category === "P3D" && (
                  <>
                    {isB2B && (
                      <p className="process-note">
                        P3D-04 B2B: etapas 1–4 apenas. A entrega é composta
                        pelos arquivos scan + CAD anexados abaixo.
                      </p>
                    )}
                    {isRepair && (
                      <Field label="Decisão P3D-05 · etapa 2">
                        <select
                          disabled={readOnly}
                          value={draft.repairMode}
                          onChange={event => {
                            const repairMode = event.target
                              .value as JobWorkflow["repairMode"];
                            const tasks = { ...draft.tasks };
                            for (const task of buildChecklist(draft))
                              if (task.category === "P3D" && task.step >= 2)
                                tasks[task.id] = { done: false };
                            patch({
                              repairMode,
                              tasks,
                              details: resetFitDetails(draft.details),
                              afterPhotos: [],
                            });
                          }}
                        >
                          <option value="">Decidir na viabilidade</option>
                          <option value="repair">
                            Reparar a peça existente
                          </option>
                          <option value="recreate">
                            Recriar · seguir etapas 3–10
                          </option>
                        </select>
                      </Field>
                    )}
                    <h3>Histórico CAD · somente novas versões</h3>
                    <ol className="process-version-list">
                      {draft.cadVersions.map((name, index) => (
                        <li key={name}>
                          <span className="mono">
                            {index + 1} · {name}
                          </span>
                        </li>
                      ))}
                    </ol>
                    {!draft.cadVersions.length && (
                      <p className="muted">
                        Nenhuma versão registrada. Comece por v1.
                      </p>
                    )}
                    <Field
                      label="Nova versão CAD"
                      help="Nome único, vinculado aos arquivos do projeto. Adicionar ou reprovar reabre CAD e todas as tarefas posteriores; nunca sobrescreve uma versão."
                    >
                      <input
                        disabled={readOnly}
                        value={version}
                        onChange={event => setVersion(event.target.value)}
                        placeholder="Ex.: v1 ou v2 — correção do encaixe"
                      />
                    </Field>
                    <div className="row wrap">
                      <Button
                        disabled={readOnly}
                        onClick={() => appendVersion()}
                      >
                        Adicionar versão CAD
                      </Button>
                      {!isB2B && (
                        <Button
                          variant="danger"
                          disabled={readOnly}
                          onClick={() => appendVersion(true)}
                        >
                          Reprovar fit test e retornar ao CAD
                        </Button>
                      )}
                    </div>
                  </>
                )}
                <div className="process-form-grid">
                  {categoryFields[category].map(field => (
                    <Field
                      key={field.key}
                      label={field.label}
                      className={field.type === "textarea" ? "field-full" : ""}
                    >
                      {field.type === "boolean" ? (
                        <select
                          disabled={readOnly}
                          value={
                            draft.details[field.key] === true
                              ? "yes"
                              : draft.details[field.key] === false
                                ? "no"
                                : ""
                          }
                          onChange={event => {
                            const value = event.target.value;
                            const details = { ...draft.details };
                            if (!value) delete details[field.key];
                            else details[field.key] = value === "yes";
                            patch({ details });
                          }}
                        >
                          <option value="">Não registrado</option>
                          <option value="yes">Sim</option>
                          <option value="no">Não</option>
                        </select>
                      ) : field.type === "date" ? (
                        <DateInput
                          disabled={readOnly}
                          value={String(draft.details[field.key] ?? "")}
                          onChange={event =>
                            patch({
                              details: {
                                ...draft.details,
                                [field.key]: event.target.value,
                              },
                            })
                          }
                        />
                      ) : field.type === "textarea" ? (
                        <textarea
                          rows={3}
                          disabled={readOnly}
                          value={String(draft.details[field.key] ?? "")}
                          onChange={event =>
                            patch({
                              details: {
                                ...draft.details,
                                [field.key]: event.target.value,
                              },
                            })
                          }
                        />
                      ) : (
                        <input
                          disabled={readOnly}
                          value={String(draft.details[field.key] ?? "")}
                          onChange={event =>
                            patch({
                              details: {
                                ...draft.details,
                                [field.key]: event.target.value,
                              },
                            })
                          }
                        />
                      )}
                    </Field>
                  ))}
                </div>
              </section>
            ))}
            {attachmentSection(
              "before",
              "Fotos ANTES · evidência da avaliação",
              draft.beforePhotos
            )}
            <p className="helper">
              Salve as fotos selecionadas primeiro. A tarefa de evidência só é
              liberada depois que a imagem real estiver persistida.
            </p>
            <JobChecklist
              workflow={draft}
              readOnly={readOnly}
              onChange={workflow => {
                const incomplete = buildChecklist(workflow).some(
                  task => !workflow.tasks[task.id]?.done
                );
                const missingEvaluation = buildChecklist(workflow).some(
                  task =>
                    ["FAR-01", "PDR-01"].includes(task.id) &&
                    !workflow.tasks[task.id]?.done
                );
                if (
                  incomplete &&
                  missingEvaluation &&
                  pipeline.findIndex(stage => stage.id === workflow.stage) >= 2
                ) {
                  workflow = {
                    ...workflow,
                    stage: "evaluation",
                    deliveryDate: "",
                    reviewRequested: null,
                  };
                  setTarget("evaluation");
                } else if (
                  incomplete &&
                  pipeline.findIndex(stage => stage.id === workflow.stage) >= 6
                ) {
                  workflow = {
                    ...workflow,
                    stage: "production",
                    deliveryDate: "",
                    reviewRequested: null,
                  };
                  setTarget("production");
                }
                setDraft(workflow);
                setSaved("");
              }}
            />
            {isB2B && (
              <p className="process-note">
                B2B também usa os portões universais: anexe imagem real da
                avaliação e evidência digital depois (por exemplo, captura
                PNG/JPEG do CAD concluído). Os arquivos scan + CAD são entregues
                nos anexos.
              </p>
            )}
            {attachmentSection(
              "after",
              "Fotos DEPOIS · controle de qualidade",
              draft.afterPhotos
            )}
          </>
        )}
        {attachmentSection(
          "files",
          official && isB2B
            ? "Entrega B2B · arquivos scan + CAD"
            : "Anexos e arquivo histórico do projeto",
          order.attachments ?? []
        )}
      </form>
    </Modal>
  );
}
