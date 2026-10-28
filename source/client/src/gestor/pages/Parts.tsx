import { useMemo, useState } from "react";
import type { Attachment, Order, Part, PartRevision } from "../../lib/models";
import { stripDownloadUrlToken } from "../../lib/attachments";
import { dateLabel, makeId } from "../types";
import { useGestor } from "../store";
import {
  Badge,
  Button,
  ConfirmButton,
  EmptyState,
  Field,
  FormModal,
  Modal,
  PageHeading,
} from "../components/ui";

const MAX_STL_BYTES = 50 * 1024 * 1024;

function now(): string {
  return new Date().toISOString();
}

function uniqueIds(ids: string[]): string[] {
  return Array.from(new Set(ids.filter(Boolean)));
}

function attachmentKey(attachment: Attachment, _index = 0): string {
  return (
    attachment.id ??
    attachment.storagePath ??
    `${attachment.name}-${attachment.uploadedAt ?? ""}-${attachment.size ?? ""}-${attachment.contentType ?? ""}`
  );
}

/**
 * Attachments are stored as metadata. Firebase download URLs are bearer tokens and
 * must never be written back to a revision or rendered as a link.
 */
function safeAttachment(attachment: Attachment): Attachment {
  return stripDownloadUrlToken(attachment);
}

function safeAttachments(attachments: Attachment[]): Attachment[] {
  return attachments.map(safeAttachment);
}

function newPart(): Part {
  return {
    id: makeId("part"),
    name: "",
    invoiceIds: [],
    createdAt: now(),
  };
}

function newRevision(partId: string): PartRevision {
  return {
    id: makeId("revision"),
    partId,
    title: "",
    version: "1",
    notes: "",
    attachments: [],
    invoiceIds: [],
    createdAt: now(),
  };
}

function clonePart(part: Part): Part {
  return { ...part, invoiceIds: [...(part.invoiceIds ?? [])] };
}

function cloneRevision(revision: PartRevision): PartRevision {
  return {
    ...revision,
    invoiceIds: [...(revision.invoiceIds ?? [])],
    attachments: safeAttachments(revision.attachments ?? []),
  };
}

function invoiceLabel(invoice: Order): string {
  return (
    [invoice.clientName, invoice.title].filter(Boolean).join(" · ") ||
    `Invoice ${invoice.id}`
  );
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes < 1) return "Tamanho não informado";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function revisionSort(a: PartRevision, b: PartRevision): number {
  const left = a.updatedAt ?? a.createdAt;
  const right = b.updatedAt ?? b.createdAt;
  return right.localeCompare(left);
}

function isStl(file: File): boolean {
  return (
    /\.stl$/i.test(file.name) && file.size > 0 && file.size <= MAX_STL_BYTES
  );
}

type InvoiceSelectorProps = {
  invoices: Order[];
  selectedIds: string[];
  onChange: (invoiceIds: string[]) => void;
  idPrefix: string;
};

function InvoiceSelector({
  invoices,
  selectedIds,
  onChange,
  idPrefix,
}: InvoiceSelectorProps) {
  if (!invoices.length) {
    return <p className="muted">Não há invoices disponíveis para vincular.</p>;
  }

  function toggle(invoiceId: string, checked: boolean) {
    onChange(
      checked
        ? uniqueIds([...selectedIds, invoiceId])
        : selectedIds.filter(id => id !== invoiceId)
    );
  }

  return (
    <fieldset className="stack" aria-label="Invoices relacionadas">
      <legend>Invoices relacionadas</legend>
      {invoices.map(invoice => {
        const inputId = `${idPrefix}-invoice-${invoice.id}`;
        return (
          <label className="row" htmlFor={inputId} key={invoice.id}>
            <input
              id={inputId}
              type="checkbox"
              checked={selectedIds.includes(invoice.id)}
              onChange={event =>
                toggle(invoice.id, event.currentTarget.checked)
              }
            />
            <span>
              {invoiceLabel(invoice)}
              {invoice.status ? (
                <small className="muted"> · {invoice.status}</small>
              ) : null}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

type PartFormProps = {
  part: Part;
  invoices: Order[];
  linkedRevisionCount: number;
  onChange: (part: Part) => void;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  onDelete: () => Promise<void>;
};

function PartForm({
  part,
  invoices,
  linkedRevisionCount,
  onChange,
  onClose,
  onSubmit,
  onDelete,
}: PartFormProps) {
  const [isNew] = useState(() => !part.name.trim() && !part.updatedAt);

  return (
    <FormModal
      title={isNew ? "Nova peça" : "Editar peça"}
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel={isNew ? "Criar peça" : "Salvar peça"}
    >
      <div className="form-grid">
        <Field
          label="Nome da peça"
          error={!part.name.trim() ? "Informe o nome da peça." : undefined}
          className="field-full"
        >
          <input
            autoFocus
            required
            value={part.name}
            onChange={event =>
              onChange({ ...part, name: event.currentTarget.value })
            }
            placeholder="Ex.: Moldura de farol esquerdo"
          />
        </Field>
        <div className="field field-full">
          <span className="field-label">Vínculos financeiros</span>
          <InvoiceSelector
            invoices={invoices}
            selectedIds={part.invoiceIds ?? []}
            onChange={invoiceIds => onChange({ ...part, invoiceIds })}
            idPrefix={`part-${part.id}`}
          />
          <small className="helper">
            Selecione as invoices às quais esta peça pertence.
          </small>
        </div>
      </div>

      {!isNew ? (
        <div className="card-footer row wrap">
          {linkedRevisionCount ? (
            <p className="helper" role="status">
              Esta peça tem {linkedRevisionCount} revisão(ões). Remova ou mova
              as revisões antes de excluir a peça.
            </p>
          ) : (
            <ConfirmButton
              label="Excluir peça"
              confirmation={`Excluir “${part.name || "esta peça"}”? Esta ação não pode ser desfeita.`}
              onConfirm={onDelete}
              variant="danger"
            />
          )}
        </div>
      ) : null}
    </FormModal>
  );
}

type RevisionEditorProps = {
  revision: PartRevision;
  parts: Part[];
  invoices: Order[];
  onChange: (revision: PartRevision) => void;
  onClose: () => void;
  onSave: (
    pendingFiles: File[],
    attachmentsToRemove: Attachment[]
  ) => Promise<void>;
  onDownload: (attachment: Attachment) => Promise<void>;
};

function RevisionEditor({
  revision,
  parts,
  invoices,
  onChange,
  onClose,
  onSave,
  onDownload,
}: RevisionEditorProps) {
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [removedAttachmentKeys, setRemovedAttachmentKeys] = useState<string[]>(
    []
  );
  const [attachmentError, setAttachmentError] = useState("");
  const [downloadingKey, setDownloadingKey] = useState("");

  const visibleAttachments = revision.attachments.filter(
    (attachment, index) =>
      !removedAttachmentKeys.includes(attachmentKey(attachment, index))
  );
  const attachmentsToRemove = revision.attachments.filter((attachment, index) =>
    removedAttachmentKeys.includes(attachmentKey(attachment, index))
  );

  function queueFile(file?: File) {
    if (!file) return;
    if (!isStl(file)) {
      setAttachmentError(
        "Selecione um arquivo .STL válido, entre 1 byte e 50 MB."
      );
      return;
    }
    setAttachmentError("");
    setPendingFiles(current => [...current, file]);
  }

  async function download(attachment: Attachment, index: number) {
    const key = attachmentKey(attachment, index);
    if (!attachment.storagePath) {
      setAttachmentError(
        "Este anexo não tem caminho autenticado. Reenvie o arquivo para disponibilizar o download."
      );
      return;
    }

    setDownloadingKey(key);
    setAttachmentError("");
    try {
      await onDownload(attachment);
    } catch (error) {
      setAttachmentError(
        error instanceof Error
          ? error.message
          : "Não foi possível baixar o arquivo."
      );
    } finally {
      setDownloadingKey("");
    }
  }

  function markAttachmentForRemoval(attachment: Attachment, index: number) {
    const key = attachmentKey(attachment, index);
    setRemovedAttachmentKeys(current => uniqueIds([...current, key]));
  }

  function restoreAttachment(attachment: Attachment, index: number) {
    const key = attachmentKey(attachment, index);
    setRemovedAttachmentKeys(current => current.filter(value => value !== key));
  }

  async function submit() {
    if (
      !revision.partId ||
      !revision.title.trim() ||
      !revision.version.trim()
    ) {
      throw new Error("Selecione a peça e informe título e versão.");
    }
    if (!parts.some(part => part.id === revision.partId)) {
      throw new Error(
        "A peça selecionada não está mais disponível. Feche e reabra a revisão."
      );
    }
    await onSave(pendingFiles, attachmentsToRemove);
  }

  return (
    <FormModal
      title={
        revision.title ? `Editar revisão · ${revision.title}` : "Nova revisão"
      }
      onClose={onClose}
      onSubmit={submit}
      submitLabel={
        pendingFiles.length ? "Enviar STL e salvar" : "Salvar revisão"
      }
    >
      <div className="form-grid">
        <Field
          label="Peça"
          error={!revision.partId ? "Selecione a peça." : undefined}
        >
          <select
            required
            value={revision.partId}
            onChange={event =>
              onChange({ ...revision, partId: event.currentTarget.value })
            }
          >
            <option value="">Selecione uma peça</option>
            {parts.map(part => (
              <option key={part.id} value={part.id}>
                {part.name}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Versão"
          error={!revision.version.trim() ? "Informe a versão." : undefined}
        >
          <input
            required
            value={revision.version}
            onChange={event =>
              onChange({ ...revision, version: event.currentTarget.value })
            }
            placeholder="Ex.: 1.0"
          />
        </Field>
        <Field
          label="Título da versão"
          error={!revision.title.trim() ? "Informe o título." : undefined}
          className="field-full"
        >
          <input
            required
            value={revision.title}
            onChange={event =>
              onChange({ ...revision, title: event.currentTarget.value })
            }
            placeholder="Ex.: Geometria após ajuste de montagem"
          />
        </Field>
        <Field label="Notas" className="field-full">
          <textarea
            value={revision.notes}
            onChange={event =>
              onChange({ ...revision, notes: event.currentTarget.value })
            }
            placeholder="Contexto, medidas, premissas, validações e limitações conhecidas."
          />
        </Field>
        <div className="field field-full">
          <span className="field-label">Vínculos financeiros</span>
          <InvoiceSelector
            invoices={invoices}
            selectedIds={revision.invoiceIds ?? []}
            onChange={invoiceIds => onChange({ ...revision, invoiceIds })}
            idPrefix={`revision-${revision.id}`}
          />
          <small className="helper">
            Os vínculos da revisão são persistidos junto com seu ponteiro de
            peça.
          </small>
        </div>
        <Field
          label="Arquivo STL"
          help="O arquivo fica apenas nesta tela até Salvar revisão. Nenhum upload é iniciado ao selecionar ou cancelar."
          className="field-full"
        >
          <input
            type="file"
            accept=".stl,model/stl,application/sla,application/vnd.ms-pki.stlapplication"
            onChange={event => {
              queueFile(event.currentTarget.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
        </Field>

        {attachmentError ? (
          <p className="error-message field-full" role="alert">
            {attachmentError}
          </p>
        ) : null}

        {visibleAttachments.length ? (
          <div className="field-full stack" aria-label="Anexos já salvos">
            <strong>Anexos salvos</strong>
            {visibleAttachments.map((attachment, index) => {
              const key = attachmentKey(attachment, index);
              return (
                <div className="list-row" key={key}>
                  <span>
                    {attachment.name}{" "}
                    <small className="muted">
                      · {formatBytes(attachment.size)}
                    </small>
                  </span>
                  <span className="row wrap">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={
                        !attachment.storagePath || downloadingKey === key
                      }
                      onClick={() => void download(attachment, index)}
                    >
                      {downloadingKey === key ? "Baixando…" : "Baixar"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() =>
                        markAttachmentForRemoval(attachment, index)
                      }
                    >
                      Remover
                    </Button>
                  </span>
                </div>
              );
            })}
          </div>
        ) : null}

        {attachmentsToRemove.length ? (
          <div
            className="field-full stack"
            aria-label="Anexos marcados para remoção"
          >
            <strong>Remoção pendente</strong>
            <p className="helper">
              Os arquivos serão removidos do armazenamento somente após salvar a
              revisão.
            </p>
            {attachmentsToRemove.map((attachment, index) => (
              <div className="list-row" key={attachmentKey(attachment, index)}>
                <span>{attachment.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => restoreAttachment(attachment, index)}
                >
                  Manter arquivo
                </Button>
              </div>
            ))}
          </div>
        ) : null}

        {pendingFiles.length ? (
          <div className="field-full stack" aria-label="Arquivos STL pendentes">
            <strong>STL pendente de envio</strong>
            {pendingFiles.map((file, index) => (
              <div
                className="list-row"
                key={`${file.name}-${file.lastModified}-${index}`}
              >
                <span>
                  {file.name}{" "}
                  <small className="muted">
                    · {formatBytes(file.size)} · será enviado ao salvar
                  </small>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    setPendingFiles(current =>
                      current.filter((_, fileIndex) => fileIndex !== index)
                    )
                  }
                >
                  Remover da fila
                </Button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </FormModal>
  );
}

type RevisionDetailsProps = {
  revision: PartRevision;
  part?: Part;
  invoices: Order[];
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  onDownload: (attachment: Attachment) => Promise<void>;
};

function RevisionDetails({
  revision,
  part,
  invoices,
  onClose,
  onEdit,
  onDelete,
  onDownload,
}: RevisionDetailsProps) {
  const [attachmentError, setAttachmentError] = useState("");
  const [downloadingKey, setDownloadingKey] = useState("");
  const selectedInvoices = revision.invoiceIds.map(invoiceId =>
    invoices.find(invoice => invoice.id === invoiceId)
  );

  async function download(attachment: Attachment, index: number) {
    const key = attachmentKey(attachment, index);
    if (!attachment.storagePath) {
      setAttachmentError(
        "Este anexo não tem caminho autenticado. Reenvie o arquivo para disponibilizar o download."
      );
      return;
    }
    setDownloadingKey(key);
    setAttachmentError("");
    try {
      await onDownload(attachment);
    } catch (error) {
      setAttachmentError(
        error instanceof Error
          ? error.message
          : "Não foi possível baixar o arquivo."
      );
    } finally {
      setDownloadingKey("");
    }
  }

  return (
    <Modal
      title={`Revisão ${revision.version} · ${revision.title}`}
      onClose={onClose}
      footer={
        <div className="row wrap">
          <ConfirmButton
            label="Excluir revisão"
            confirmation={`Excluir a revisão “${revision.title}” (${revision.version})? Os anexos associados não serão apagados antes da persistência do registro.`}
            onConfirm={onDelete}
            variant="danger"
          />
          <Button type="button" variant="secondary" onClick={onClose}>
            Fechar
          </Button>
          <Button type="button" variant="primary" onClick={onEdit}>
            Editar revisão
          </Button>
        </div>
      }
    >
      <div className="stack">
        <div className="details-grid">
          <div className="key-value">
            <span>Peça</span>
            <strong>{part?.name ?? "Peça removida ou não disponível"}</strong>
          </div>
          <div className="key-value">
            <span>Versão</span>
            <strong>{revision.version}</strong>
          </div>
          <div className="key-value">
            <span>Criada em</span>
            <strong>{dateLabel(revision.createdAt)}</strong>
          </div>
          <div className="key-value">
            <span>Atualizada em</span>
            <strong>
              {dateLabel(revision.updatedAt ?? revision.createdAt)}
            </strong>
          </div>
        </div>

        <section aria-labelledby={`revision-notes-${revision.id}`}>
          <h3 id={`revision-notes-${revision.id}`}>Notas</h3>
          <p>{revision.notes || "Sem notas registradas."}</p>
        </section>

        <section aria-labelledby={`revision-invoices-${revision.id}`}>
          <h3 id={`revision-invoices-${revision.id}`}>Invoices relacionadas</h3>
          {revision.invoiceIds.length ? (
            <ul className="list">
              {selectedInvoices.map((invoice, index) => (
                <li className="list-row" key={revision.invoiceIds[index]}>
                  {invoice
                    ? invoiceLabel(invoice)
                    : `Invoice não disponível · ${revision.invoiceIds[index]}`}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Nenhuma invoice vinculada a esta revisão.</p>
          )}
        </section>

        <section aria-labelledby={`revision-attachments-${revision.id}`}>
          <h3 id={`revision-attachments-${revision.id}`}>Anexos STL</h3>
          {attachmentError ? (
            <p className="error-message" role="alert">
              {attachmentError}
            </p>
          ) : null}
          {revision.attachments.length ? (
            <ul className="list">
              {revision.attachments.map((attachment, index) => {
                const key = attachmentKey(attachment, index);
                return (
                  <li className="list-row" key={key}>
                    <span>
                      {attachment.name}{" "}
                      <small className="muted">
                        · {formatBytes(attachment.size)}
                        {attachment.uploadedAt
                          ? ` · ${dateLabel(attachment.uploadedAt)}`
                          : ""}
                      </small>
                    </span>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={
                        !attachment.storagePath || downloadingKey === key
                      }
                      onClick={() => void download(attachment, index)}
                    >
                      {downloadingKey === key ? "Baixando…" : "Baixar STL"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="muted">Nenhum STL anexado.</p>
          )}
        </section>
      </div>
    </Modal>
  );
}

export default function PartsPage() {
  const ctx = useGestor();
  const [partDraft, setPartDraft] = useState<Part | null>(null);
  const [revisionDraft, setRevisionDraft] = useState<PartRevision | null>(null);
  const [revisionDetails, setRevisionDetails] = useState<PartRevision | null>(
    null
  );

  const parts = ctx.data.parts;
  const revisions = ctx.data.partRevisions;
  const invoices = useMemo(
    () => ctx.data.orders.filter(order => order.documentType === "Invoice"),
    [ctx.data.orders]
  );
  const search = ctx.search.trim().toLocaleLowerCase("pt-BR");

  const revisionsByPart = useMemo(() => {
    const grouped = new Map<string, PartRevision[]>();
    for (const revision of revisions) {
      const collection = grouped.get(revision.partId) ?? [];
      collection.push(revision);
      grouped.set(revision.partId, collection);
    }
    for (const collection of grouped.values()) collection.sort(revisionSort);
    return grouped;
  }, [revisions]);

  const filteredParts = useMemo(() => {
    if (!search) return parts;
    return parts.filter(part => {
      const partRevisions = revisionsByPart.get(part.id) ?? [];
      const invoiceText = part.invoiceIds
        .map(id =>
          invoiceLabel(
            invoices.find(invoice => invoice.id === id) ??
              ({ id, clientName: "", title: "" } as Order)
          )
        )
        .join(" ");
      const haystack = [
        part.name,
        invoiceText,
        ...partRevisions.flatMap(revision => [
          revision.version,
          revision.title,
          revision.notes,
        ]),
      ]
        .join(" ")
        .toLocaleLowerCase("pt-BR");
      return haystack.includes(search);
    });
  }, [invoices, parts, revisionsByPart, search]);

  const orphanRevisions = useMemo(
    () =>
      revisions
        .filter(revision => !parts.some(part => part.id === revision.partId))
        .sort(revisionSort),
    [parts, revisions]
  );

  async function savePart() {
    if (!partDraft) return;
    const name = partDraft.name.trim();
    if (!name) throw new Error("Informe o nome da peça.");

    const saved: Part = {
      ...partDraft,
      name,
      invoiceIds: uniqueIds(partDraft.invoiceIds ?? []),
      updatedAt: now(),
    };
    await ctx.save("parts", saved);
    ctx.notify("Peça salva com os vínculos de invoice.", "success");
  }

  async function saveRevision(
    pendingFiles: File[],
    attachmentsToRemove: Attachment[]
  ) {
    if (!revisionDraft) return;
    const part = parts.find(item => item.id === revisionDraft.partId);
    if (!part) throw new Error("A peça selecionada não está disponível.");

    const removedKeys = new Set(
      attachmentsToRemove.map((attachment, index) =>
        attachmentKey(attachment, index)
      )
    );
    const retainedAttachments = revisionDraft.attachments.filter(
      (attachment, index) => !removedKeys.has(attachmentKey(attachment, index))
    );
    const uploaded: Attachment[] = [];

    try {
      for (const file of pendingFiles) {
        if (!isStl(file)) {
          throw new Error(
            `O arquivo “${file.name}” não é um STL válido de até 50 MB.`
          );
        }
        const attachment = await ctx.upload(revisionDraft.id, file, "stl");
        uploaded.push(safeAttachment(attachment));
      }

      const saved: PartRevision = {
        ...revisionDraft,
        partId: part.id,
        title: revisionDraft.title.trim(),
        version: revisionDraft.version.trim(),
        notes: revisionDraft.notes.trim(),
        invoiceIds: uniqueIds(revisionDraft.invoiceIds ?? []),
        attachments: safeAttachments([...retainedAttachments, ...uploaded]),
        updatedAt: now(),
      };

      // The context writes the revision and its part pointers in one atomic operation.
      await ctx.saveRevision(saved);
    } catch (error) {
      const cleanup = await Promise.allSettled(
        uploaded
          .filter(attachment => Boolean(attachment.storagePath))
          .map(attachment => ctx.removeFile(attachment))
      );
      const cleanupFailures = cleanup.filter(
        result => result.status === "rejected"
      ).length;
      const baseMessage =
        error instanceof Error
          ? error.message
          : "Não foi possível salvar a revisão.";
      if (cleanupFailures) {
        ctx.notify(
          `${cleanupFailures} arquivo(s) enviado(s) não puderam ser removidos automaticamente.`,
          "error"
        );
        throw new Error(
          `${baseMessage} A limpeza compensatória falhou para ${cleanupFailures} arquivo(s); revise o armazenamento.`
        );
      }
      if (uploaded.length) {
        ctx.notify(
          "A revisão não foi salva; os arquivos enviados nesta tentativa foram removidos.",
          "info"
        );
      }
      throw new Error(baseMessage);
    }

    const deletionResults = await Promise.allSettled(
      attachmentsToRemove
        .filter(attachment => Boolean(attachment.storagePath))
        .map(attachment => ctx.removeFile(safeAttachment(attachment)))
    );
    const deletionFailures = deletionResults.filter(
      result => result.status === "rejected"
    ).length;
    if (deletionFailures) {
      ctx.notify(
        `A revisão foi salva, mas ${deletionFailures} arquivo(s) removido(s) permanecem no armazenamento e exigem limpeza.`,
        "error"
      );
    }

    ctx.notify("Revisão salva e vínculos atualizados.", "success");
  }

  async function downloadAttachment(attachment: Attachment) {
    // Download uses authenticated context access. Never rely on legacy bearer URLs.
    await ctx.download(safeAttachment(attachment));
  }

  async function removePart(part: Part) {
    const linkedRevisions = revisionsByPart.get(part.id) ?? [];
    if (linkedRevisions.length) {
      throw new Error(
        "Esta peça possui revisões vinculadas. Mova ou remova as revisões antes de excluir a peça."
      );
    }
    await ctx.remove("parts", part.id);
    ctx.notify("Peça removida com segurança.", "success");
    setPartDraft(null);
  }

  async function removeRevision(revision: PartRevision) {
    // remove('partRevisions') clears a matching currentRevisionId in the same store transaction.
    await ctx.remove("partRevisions", revision.id);
    ctx.notify("Revisão removida com segurança.", "success");
    setRevisionDetails(null);
    setRevisionDraft(null);
  }

  if (ctx.loading) {
    return (
      <div className="card" role="status">
        Carregando peças e revisões…
      </div>
    );
  }

  if (ctx.error) {
    return (
      <div className="card stack" role="alert">
        <p className="error-message">{ctx.error}</p>
        <div>
          <Button type="button" variant="secondary" onClick={ctx.retry}>
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  return (
    <main className="stack" aria-labelledby="parts-heading">
      <PageHeading
        eyebrow="Engenharia"
        title="Peças e revisões"
        description="Mantenha o histórico de versões, invoices e arquivos STL de cada peça."
        action={
          <Button
            type="button"
            variant="primary"
            onClick={() => setPartDraft(newPart())}
          >
            Nova peça
          </Button>
        }
      />

      <div className="toolbar" role="search">
        <label className="field" htmlFor="parts-search">
          <span className="sr-only">Buscar peças e revisões</span>
          <input
            id="parts-search"
            type="search"
            value={ctx.search}
            onChange={event => ctx.setSearch(event.currentTarget.value)}
            placeholder="Buscar peça, revisão, nota ou invoice"
          />
        </label>
        <span className="muted">
          {filteredParts.length} de {parts.length} peça(s)
        </span>
      </div>

      {filteredParts.length ? (
        <div className="grid grid-2">
          {filteredParts.map(part => {
            const partRevisions = revisionsByPart.get(part.id) ?? [];
            const currentRevision = partRevisions.find(
              revision => revision.id === part.currentRevisionId
            );
            return (
              <article
                className="card stack"
                key={part.id}
                aria-labelledby={`part-${part.id}`}
              >
                <header className="card-head split">
                  <div>
                    <p className="eyebrow">Peça</p>
                    <h2 id={`part-${part.id}`}>{part.name}</h2>
                  </div>
                  <div className="row wrap">
                    <Badge tone="neutral">
                      {partRevisions.length} revisão(ões)
                    </Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setPartDraft(clonePart(part))}
                    >
                      Editar
                    </Button>
                  </div>
                </header>

                <div className="key-value">
                  <span>Invoices</span>
                  <strong>
                    {part.invoiceIds.length
                      ? `${part.invoiceIds.length} vinculada(s)`
                      : "Sem invoice vinculada"}
                  </strong>
                </div>
                <div className="key-value">
                  <span>Revisão atual</span>
                  <strong>
                    {currentRevision
                      ? `${currentRevision.title} · v${currentRevision.version}`
                      : "Ainda não definida"}
                  </strong>
                </div>

                <div className="card-footer row wrap">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setRevisionDraft(newRevision(part.id))}
                  >
                    Nova revisão
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setPartDraft(clonePart(part))}
                  >
                    Gerenciar peça
                  </Button>
                </div>

                <section
                  aria-labelledby={`history-${part.id}`}
                  className="stack"
                >
                  <h3 id={`history-${part.id}`}>Histórico</h3>
                  {partRevisions.length ? (
                    <ul className="list">
                      {partRevisions.map(revision => (
                        <li className="list-row" key={revision.id}>
                          <span>
                            <strong>
                              {revision.title} · v{revision.version}
                            </strong>
                            <small className="muted">
                              {revision.notes || "Sem notas"} ·{" "}
                              {revision.attachments.length} STL ·{" "}
                              {dateLabel(
                                revision.updatedAt ?? revision.createdAt
                              )}
                            </small>
                          </span>
                          <span className="row wrap">
                            {part.currentRevisionId === revision.id ? (
                              <Badge tone="gold">Atual</Badge>
                            ) : null}
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() =>
                                setRevisionDetails(cloneRevision(revision))
                              }
                            >
                              Detalhes
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() =>
                                setRevisionDraft(cloneRevision(revision))
                              }
                            >
                              Editar
                            </Button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">
                      Nenhuma revisão registrada para esta peça.
                    </p>
                  )}
                </section>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title={
            parts.length
              ? "Nenhuma peça corresponde à busca"
              : "Nenhuma peça cadastrada"
          }
          description={
            parts.length
              ? "Tente outros termos de busca ou limpe o filtro."
              : "Cadastre uma peça para iniciar seu histórico de engenharia."
          }
          action={
            parts.length ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => ctx.setSearch("")}
              >
                Limpar busca
              </Button>
            ) : (
              <Button
                type="button"
                variant="primary"
                onClick={() => setPartDraft(newPart())}
              >
                Cadastrar peça
              </Button>
            )
          }
        />
      )}

      {orphanRevisions.length ? (
        <section
          className="card stack"
          aria-labelledby="orphan-revisions-heading"
        >
          <div className="card-head">
            <p className="eyebrow">Atenção necessária</p>
            <h2 id="orphan-revisions-heading">Revisões sem peça disponível</h2>
            <p className="muted">
              Mova estas revisões para uma peça existente ou remova-as com
              segurança.
            </p>
          </div>
          <ul className="list">
            {orphanRevisions.map(revision => (
              <li className="list-row" key={revision.id}>
                <span>
                  <strong>
                    {revision.title} · v{revision.version}
                  </strong>
                  <small className="muted">ID de peça: {revision.partId}</small>
                </span>
                <span className="row wrap">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setRevisionDetails(cloneRevision(revision))}
                  >
                    Detalhes
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setRevisionDraft(cloneRevision(revision))}
                  >
                    Mover ou editar
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {partDraft ? (
        <PartForm
          part={partDraft}
          invoices={invoices}
          linkedRevisionCount={(revisionsByPart.get(partDraft.id) ?? []).length}
          onChange={setPartDraft}
          onClose={() => setPartDraft(null)}
          onSubmit={savePart}
          onDelete={() => removePart(partDraft)}
        />
      ) : null}

      {revisionDraft ? (
        <RevisionEditor
          revision={revisionDraft}
          parts={parts}
          invoices={invoices}
          onChange={setRevisionDraft}
          onClose={() => setRevisionDraft(null)}
          onSave={saveRevision}
          onDownload={downloadAttachment}
        />
      ) : null}

      {revisionDetails ? (
        <RevisionDetails
          revision={revisionDetails}
          part={parts.find(part => part.id === revisionDetails.partId)}
          invoices={invoices}
          onClose={() => setRevisionDetails(null)}
          onEdit={() => {
            setRevisionDraft(cloneRevision(revisionDetails));
            setRevisionDetails(null);
          }}
          onDelete={() => removeRevision(revisionDetails)}
          onDownload={downloadAttachment}
        />
      ) : null}
    </main>
  );
}
