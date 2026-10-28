import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { User } from "firebase/auth";
import {
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  type Transaction,
} from "firebase/firestore";
import {
  auth,
  db,
  workspaceCollection,
  workspaceDoc,
  uploadDocumentAttachment,
  uploadStlAttachment,
  downloadStoredAttachment,
  deleteStoredAttachment,
  USING_EMULATORS,
  WORKSPACE_ID,
} from "../lib/firebase";
import type {
  Attachment,
  CalendarEvent,
  Material,
  PartRevision,
} from "../lib/models";
import {
  allocations,
  collectionKeys,
  demoData,
  emptyData,
  loadLegacy,
  normalizeRecord,
  normalizeStudioOrder,
  requireNumber,
  reserveMaterials,
  safeDelete,
  safeRecord,
} from "./domain";
import {
  saveOrderAtomic,
  convertEstimateAtomic,
  saveRevisionAtomic,
} from "./repository";
import {
  type CollectionKey,
  type EntityMap,
  type GestorContext,
  type JourneyStage,
  type StudioData,
  type StudioOrder,
  type StudioView,
  initialSettings,
  journey,
  makeId,
} from "./types";

const Context = createContext<GestorContext | null>(null);
export function useOptionalGestor() {
  return useContext(Context);
}
export function useGestor() {
  const context = useContext(Context);
  if (!context) throw new Error("O Gestor precisa de um contexto de operação.");
  return context;
}
const DEMO_KEY = "reverso-automotive-demo-v1";
const views: StudioView[] = [
  "overview",
  "clients",
  "vehicles",
  "estimates",
  "invoices",
  "orders",
  "production",
  "triage",
  "calendar",
  "inventory",
  "printers",
  "parts",
  "finance",
  "expenses",
  "more",
  "settings",
];
function getDemo() {
  try {
    const saved = localStorage.getItem(DEMO_KEY);
    if (saved) {
      const data = JSON.parse(saved);
      if (collectionKeys.every(k => Array.isArray(data[k])))
        return data as StudioData;
    }
  } catch {}
  return demoData();
}
function errorText(error: unknown) {
  const code = (error as { code?: string })?.code ?? "";
  if (code.includes("permission") || code.includes("unauthorized"))
    return "Acesso não autorizado. Confira as permissões do workspace e tente novamente.";
  if (code.includes("unavailable") || code.includes("network"))
    return "Sem conexão com o armazenamento. Tente novamente quando a conexão for restabelecida.";
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir a operação.";
}
function demoDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("reverso-demo-attachments", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("files");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new Error("O navegador não permite armazenar arquivos da demonstração.")
      );
  });
}
async function demoFile(
  key: string,
  operation: "get" | "put" | "delete",
  file?: Blob
) {
  const database = await demoDb();
  try {
    return await new Promise<Blob | undefined>((resolve, reject) => {
      const transaction = database.transaction(
        "files",
        operation === "get" ? "readonly" : "readwrite"
      );
      const store = transaction.objectStore("files");
      const request =
        operation === "get"
          ? store.get(key)
          : operation === "put"
            ? store.put(file, key)
            : store.delete(key);
      let result: Blob | undefined;
      request.onsuccess = () => {
        result = request.result;
      };
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () =>
        reject(new Error("Não foi possível acessar o anexo de demonstração."));
    });
  } finally {
    database.close();
  }
}
function activeData(data: StudioData) {
  return Object.fromEntries(
    collectionKeys.map(key => [
      key,
      data[key].filter(
        record => !(record as unknown as { archived?: boolean }).archived
      ),
    ])
  ) as StudioData;
}
function patch<K extends CollectionKey>(
  data: StudioData,
  key: K,
  entity: EntityMap[K]
) {
  const list = data[key] as EntityMap[K][];
  const index = list.findIndex(item => item.id === entity.id);
  if (index >= 0) list[index] = entity;
  else list.unshift(entity);
}
function activity(
  type: CalendarEvent["type"],
  title: string,
  detail: string
): CalendarEvent {
  return {
    id: makeId("event"),
    type,
    title,
    detail,
    date: new Date().toISOString(),
  };
}
function addActivity(transaction: Transaction, event: CalendarEvent) {
  transaction.set(
    doc(workspaceCollection("calendar"), event.id),
    safeRecord(event)
  );
}

export function GestorProvider({
  children,
  user,
  demo,
  onViewChange,
}: {
  children: ReactNode;
  user: User | null;
  demo: boolean;
  onViewChange?: (view: StudioView) => void;
}) {
  const [data, setData] = useState<StudioData>(() =>
    demo ? getDemo() : emptyData()
  );
  const dataRef = useRef(data);
  dataRef.current = data;
  const [loading, setLoading] = useState(!demo),
    [error, setError] = useState(""),
    [epoch, setEpoch] = useState(0),
    [owner, setOwner] = useState(demo);
  const [notice, setNotice] = useState<{
    text: string;
    kind: "success" | "error" | "info";
  } | null>(null);
  const [view, setView] = useState<StudioView>(() => {
    const q = new URLSearchParams(location.search).get("view") as StudioView;
    return views.includes(q) ? q : "overview";
  });
  const [search, setSearch] = useState("");
  const mode = demo ? "demo" : USING_EMULATORS ? "emulator" : "firebase";
  function notify(
    text: string,
    kind: "success" | "error" | "info" = "success"
  ) {
    setNotice({ text, kind });
  }
  function navigate(next: StudioView) {
    setView(next);
    const url = new URL(location.href);
    if (next === "overview") url.searchParams.delete("view");
    else url.searchParams.set("view", next);
    history.pushState(null, "", url);
    onViewChange?.(next);
    window.scrollTo({ top: 0 });
  }
  useEffect(() => {
    const pop = () => {
      const q = new URLSearchParams(location.search).get("view") as StudioView;
      setView(views.includes(q) ? q : "overview");
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(
      () => setNotice(null),
      notice.kind === "error" ? 12000 : 5500
    );
    return () => window.clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    if (demo) {
      setLoading(false);
      const storage = (event: StorageEvent) => {
        if (event.key === DEMO_KEY) {
          const next = getDemo();
          dataRef.current = next;
          setData(next);
        }
      };
      window.addEventListener("storage", storage);
      return () => window.removeEventListener("storage", storage);
    }
    if (!user) return;
    setLoading(true);
    setError("");
    const loaded = new Set<string>();
    const failures = new Map<string, string>();
    const syncFailure = (key: string, err: unknown) => {
      failures.set(key, errorText(err));
      setError(`${key}: ${errorText(err)}`);
      setLoading(false);
    };
    const subscriptions = collectionKeys.map(key =>
      onSnapshot(
        workspaceCollection(key),
        snapshot => {
          setData(current => {
            const next = {
              ...current,
              [key]: snapshot.docs.map(record =>
                loadLegacy(key, { ...record.data(), id: record.id })
              ),
            };
            dataRef.current = next;
            return next;
          });
          loaded.add(key);
          failures.delete(key);
          setError([...failures.values()].join(" "));
          if (loaded.size === collectionKeys.length) setLoading(false);
        },
        err => syncFailure(key, err)
      )
    );
    subscriptions.push(
      onSnapshot(
        workspaceDoc(),
        snapshot => setOwner(snapshot.data()?.ownerUid === user.uid),
        err => syncFailure("workspace", err)
      )
    );
    return () => subscriptions.forEach(unsubscribe => unsubscribe());
  }, [demo, user, epoch]);
  async function localMutation(operation: (data: StudioData) => void) {
    const apply = async () => {
      const next = getDemo();
      operation(next);
      try {
        localStorage.setItem(DEMO_KEY, JSON.stringify(safeRecord(next)));
      } catch {
        throw new Error(
          "Não foi possível salvar a demonstração no navegador. Libere espaço e tente novamente."
        );
      }
      dataRef.current = next;
      setData(next);
    };
    if (navigator.locks)
      await navigator.locks.request("reverso-demo-write", apply);
    else await apply();
  }
  function ensureAuth() {
    if (!demo && !auth.currentUser)
      throw new Error("Entre no workspace para salvar dados.");
    if (!demo && !owner)
      throw new Error(
        "Acesso consultivo. Somente o responsável pelo workspace altera registros e arquivos."
      );
  }
  async function save<K extends CollectionKey>(key: K, entity: EntityMap[K]) {
    ensureAuth();
    if (key === "orders") return saveOrder(entity as StudioOrder);
    if (key === "partRevisions") return saveRevision(entity as PartRevision);
    const next = normalizeRecord(key, entity, dataRef.current);
    if (demo) {
      await localMutation(current => {
        if (key === "materials") {
          const old = current.materials.find(m => m.id === next.id);
          if (old && old.availableGrams !== (next as Material).availableGrams)
            throw new Error(
              "O saldo mudou. Use Repor ou Consumir; reabra o formulário para atualizar os dados."
            );
        }
        patch(current, key, next);
      });
    } else
      await runTransaction(db, async transaction => {
        const reference = doc(workspaceCollection(key), next.id);
        const existing = await transaction.get(reference);
        if (
          key === "materials" &&
          existing.exists() &&
          existing.data().availableGrams !== (next as Material).availableGrams
        )
          throw new Error(
            "O saldo mudou. Use os movimentos de estoque e reabra o formulário."
          );
        if (key === "settings" && !owner)
          throw new Error(
            "Somente o responsável pelo workspace altera as configurações."
          );
        transaction.set(reference, safeRecord(next), { merge: true });
      });
    notify("Registro salvo.", "success");
  }
  async function saveOrder(input: StudioOrder) {
    ensureAuth();
    const next = normalizeStudioOrder(input, dataRef.current);
    const event = activity(
      "order",
      `Documento salvo · ${next.title}`,
      `${next.documentType} · ${next.clientName}`
    );
    if (demo)
      await localMutation(current => {
        const old = current.orders.find(o => o.id === next.id);
        for (const material of reserveMaterials(old, next, current.materials))
          patch(current, "materials", material);
        patch(current, "orders", next);
        patch(current, "calendar", event);
      });
    else await saveOrderAtomic(db, WORKSPACE_ID, next, dataRef.current);
    notify("Documento salvo e estoque reconciliado.", "success");
  }
  async function convertEstimate(input: StudioOrder): Promise<StudioOrder> {
    ensureAuth();
    if (input.documentType === "Invoice")
      throw new Error("O documento já é uma invoice.");
    const newId = makeId("invoice");
    let result: StudioOrder | undefined;
    if (demo)
      await localMutation(current => {
        const saved = current.orders.find(o => o.id === input.id);
        if (!saved) throw new Error("Salve a estimativa antes de converter.");
        if (saved.invoiceId) {
          const existing = current.orders.find(o => o.id === saved.invoiceId);
          if (existing) {
            result = existing;
            return;
          }
        }
        const invoice = normalizeStudioOrder(
          {
            ...saved,
            id: newId,
            documentType: "Invoice",
            status: "Aprovado",
            clientApproved: true,
            sourceEstimateId: saved.id,
            invoiceId: undefined,
            createdAt: new Date().toISOString(),
          },
          current
        );
        for (const material of reserveMaterials(
          undefined,
          invoice,
          current.materials
        ))
          patch(current, "materials", material);
        patch(current, "orders", { ...saved, invoiceId: newId });
        patch(current, "orders", invoice);
        patch(
          current,
          "calendar",
          activity("order", "Estimativa convertida", invoice.title)
        );
        result = invoice;
      });
    else
      result = await convertEstimateAtomic(
        db,
        WORKSPACE_ID,
        input.id,
        dataRef.current
      );
    if (!result) throw new Error("Não foi possível converter a estimativa.");
    notify("Invoice criada.", "success");
    return result;
  }
  async function moveOrder(order: StudioOrder, stage: JourneyStage) {
    if (!journey.some(s => s.id === stage)) throw new Error("Etapa inválida.");
    if (order.documentType !== "Invoice")
      throw new Error(
        "Converta a estimativa em invoice para iniciar o atendimento."
      );
    await saveOrder({
      ...order,
      journeyStage: stage,
      completed: false,
      status: stage === "execute" ? "Em produção" : order.status,
      productionStage: (
        {
          evaluate: "planning",
          define: "approval",
          develop: "production",
          execute: "production",
          check: "quality",
        } as const
      )[stage],
    });
  }
  async function moveMaterial(
    material: Material,
    grams: number,
    kind: "replenish" | "consume"
  ) {
    ensureAuth();
    requireNumber(grams, "Quantidade", 0.001);
    if (!["replenish", "consume"].includes(kind))
      throw new Error("Movimento inválido.");
    const event = activity(
      "inventory",
      `${kind === "replenish" ? "Reposição" : "Consumo"} · ${material.name}`,
      `${grams} g`
    );
    const update = (current: Material) => {
      const balance =
        Math.round(
          (current.availableGrams + (kind === "replenish" ? grams : -grams)) *
            1000
        ) / 1000;
      requireNumber(balance, "Saldo resultante");
      return { ...current, availableGrams: balance };
    };
    if (demo)
      await localMutation(current => {
        const old = current.materials.find(m => m.id === material.id);
        if (!old) throw new Error("Material não encontrado.");
        patch(current, "materials", update(old));
        patch(current, "calendar", event);
      });
    else
      await runTransaction(db, async transaction => {
        const reference = doc(workspaceCollection("materials"), material.id);
        const snapshot = await transaction.get(reference);
        if (!snapshot.exists()) throw new Error("Material não encontrado.");
        const next = update({
          ...snapshot.data(),
          id: material.id,
        } as Material);
        transaction.update(reference, { availableGrams: next.availableGrams });
        addActivity(transaction, event);
      });
    notify("Movimento de estoque registrado.", "success");
  }
  async function saveRevision(input: PartRevision) {
    ensureAuth();
    const revision = normalizeRecord("partRevisions", input, dataRef.current);
    if (demo)
      await localMutation(current => {
        const previous = current.partRevisions.find(r => r.id === revision.id);
        const target = current.parts.find(p => p.id === revision.partId);
        if (!target) throw new Error("Peça não encontrada.");
        if (previous && previous.partId !== revision.partId) {
          const old = current.parts.find(p => p.id === previous.partId);
          if (old?.currentRevisionId === revision.id)
            delete old.currentRevisionId;
        }
        patch(current, "partRevisions", revision);
        patch(current, "parts", { ...target, currentRevisionId: revision.id });
      });
    else await saveRevisionAtomic(db, WORKSPACE_ID, revision, dataRef.current);
    notify("Revisão salva e vínculos atualizados.", "success");
  }
  async function remove<K extends CollectionKey>(key: K, id: string) {
    ensureAuth();
    safeDelete(key, id, activeData(dataRef.current));
    if (demo)
      await localMutation(current => {
        safeDelete(key, id, current);
        if (key === "orders") {
          const old = current.orders.find(o => o.id === id);
          for (const material of reserveMaterials(
            old,
            undefined,
            current.materials
          ))
            patch(current, "materials", material);
        }
        if (key === "partRevisions")
          for (const part of current.parts)
            if (part.currentRevisionId === id) delete part.currentRevisionId;
        current[key] = current[key].filter(entity => entity.id !== id) as any;
      });
    else
      await runTransaction(db, async transaction => {
        const reference = doc(workspaceCollection(key), id);
        const existing = await transaction.get(reference);
        if (!existing.exists()) return;
        let materials: Material[] = [];
        if (key === "orders") {
          const ids = Object.keys(allocations(existing.data() as StudioOrder));
          const snapshots = await Promise.all(
            ids.map(materialId =>
              transaction.get(doc(workspaceCollection("materials"), materialId))
            )
          );
          materials = snapshots
            .filter(s => s.exists())
            .map(s => ({ ...s.data(), id: s.id }) as Material);
        }
        let part = null;
        if (key === "partRevisions") {
          const parentId = existing.data().partId;
          part = parentId
            ? await transaction.get(doc(workspaceCollection("parts"), parentId))
            : null;
        }
        for (const material of reserveMaterials(
          key === "orders" && !existing.data().completed
            ? (existing.data() as StudioOrder)
            : undefined,
          undefined,
          materials
        ))
          transaction.update(
            doc(workspaceCollection("materials"), material.id),
            { availableGrams: material.availableGrams }
          );
        if (part?.exists() && part.data().currentRevisionId === id)
          transaction.update(part.ref, { currentRevisionId: deleteField() });
        transaction.update(reference, {
          archived: true,
          archivedAt: new Date().toISOString(),
          archivedBy: auth.currentUser?.uid,
        });
      });
    notify(
      demo
        ? "Registro excluído da demonstração."
        : "Registro arquivado. Evidências e vínculos históricos preservados.",
      "success"
    );
  }
  async function upload(
    recordId: string,
    file: File,
    kind: "document" | "stl" = "document"
  ) {
    ensureAuth();
    if (!demo)
      return kind === "stl"
        ? uploadStlAttachment(recordId, file)
        : uploadDocumentAttachment(recordId, file);
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (
      kind === "stl"
        ? extension !== "stl"
        : !["pdf", "png", "jpg", "jpeg", "stl"].includes(extension ?? "")
    )
      throw new Error("Tipo de arquivo não permitido.");
    if (file.size <= 0 || file.size > (kind === "stl" ? 50 : 15) * 1024 * 1024)
      throw new Error("Arquivo vazio ou acima do limite permitido.");
    const id = makeId("attachment");
    await demoFile(id, "put", file);
    return {
      id,
      name: file.name,
      size: file.size,
      contentType: file.type || "application/octet-stream",
      storagePath: `demo://${id}`,
      uploadedAt: new Date().toISOString(),
    };
  }
  async function download(attachment: Attachment) {
    if (!demo) return downloadStoredAttachment(attachment);
    const key = attachment.storagePath?.replace("demo://", "");
    if (!key) throw new Error("Arquivo legado sem caminho. Reenvie o anexo.");
    const file = await demoFile(key, "get");
    if (!file)
      throw new Error(
        "Anexo de demonstração não encontrado neste navegador. Reenvie o arquivo."
      );
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = attachment.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  async function removeFile(attachment: Attachment) {
    const path = attachment.storagePath;
    const shared =
      path &&
      [
        ...dataRef.current.orders.flatMap(order => order.attachments ?? []),
        ...dataRef.current.partRevisions.flatMap(
          revision => revision.attachments ?? []
        ),
        ...dataRef.current.triages.flatMap(triage => triage.photos ?? []),
      ].some(file => file.storagePath === path);
    if (shared) return; // Another source document still owns this object; never break its evidence.
    ensureAuth();
    if (!demo) return deleteStoredAttachment(attachment);
    const key = path?.replace("demo://", "");
    if (key) await demoFile(key, "delete");
  }
  const visibleData = activeData(data);
  const context: GestorContext = {
    data: visibleData,
    settings: data.settings[0] ?? initialSettings,
    loading,
    error,
    mode,
    userName: user?.displayName || user?.email?.split("@")[0] || "Demonstração",
    owner,
    view,
    navigate,
    search,
    setSearch,
    notify,
    retry: () => setEpoch(e => e + 1),
    save,
    remove,
    saveOrder,
    convertEstimate,
    moveOrder,
    moveMaterial,
    saveRevision,
    upload,
    download,
    removeFile,
  };
  return (
    <Context.Provider value={context}>
      {children}
      {notice && (
        <div
          className={`toast toast-${notice.kind}`}
          role={notice.kind === "error" ? "alert" : "status"}
        >
          <span>{notice.text}</span>
          <button
            type="button"
            aria-label="Dispensar mensagem"
            onClick={() => setNotice(null)}
          >
            ×
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
