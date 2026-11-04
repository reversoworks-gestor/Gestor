import {
  collection,
  deleteField,
  doc,
  runTransaction,
  type Firestore,
} from "firebase/firestore";
import type { Material, PartRevision } from "../lib/models";
import {
  allocations,
  normalizeRecord,
  normalizeStudioOrder,
  reserveMaterials,
  safeRecord,
} from "./domain";
import { type StudioData, type StudioOrder, makeId } from "./types";
import { timestampIso } from "./recordDates";

const recordRef = (
  database: Firestore,
  workspace: string,
  key: string,
  id: string
) => doc(database, "workspaces", workspace, key, id);

/** Shared by Firestore transactions and the demo's locked read/modify/write. */
export function prepareOrderSave(
  input: StudioOrder,
  old: StudioOrder | undefined,
  data: StudioData
): StudioOrder {
  const currentToken = timestampIso(old?.updatedAt);
  if (
    old &&
    (timestampIso(input.updatedAt) !== currentToken ||
      (!currentToken &&
        (input.updatedAt !== undefined || old.updatedAt !== undefined)))
  )
    throw new Error(
      "Este documento foi alterado por outra sessão. Reabra o registro para atualizar os dados antes de salvar."
    );
  // An omitted map is not permission to drop historical workflow guards.
  const source =
    old?.workflow && !input.workflow
      ? { ...input, workflow: old.workflow }
      : input;
  const next = normalizeStudioOrder(source, {
    ...data,
    // Never validate stage changes or CAD history against a stale client copy.
    orders: [
      ...(old ? [old] : []),
      ...data.orders.filter(order => order.id !== input.id),
    ],
  });
  // A millisecond clock collision must not let the next stale editor pass.
  if (currentToken && next.updatedAt! <= currentToken)
    next.updatedAt = new Date(
      new Date(currentToken).getTime() + 1
    ).toISOString();
  if (old?.documentType === "Invoice" && old.clientSnapshot) {
    next.clientName = old.clientName;
    next.clientSnapshot = old.clientSnapshot;
  }
  return next;
}

/** Read the current order and material balances before validating and writing. */
export async function saveOrderAtomic(
  database: Firestore,
  workspace: string,
  input: StudioOrder,
  data: StudioData
): Promise<StudioOrder> {
  let result: StudioOrder | undefined;
  await runTransaction(database, async transaction => {
    const reference = recordRef(database, workspace, "orders", input.id);
    const existing = await transaction.get(reference);
    const old = existing.exists()
      ? ({ ...existing.data(), id: existing.id } as StudioOrder)
      : undefined;
    const next = prepareOrderSave(input, old, data);
    const ids = [
      ...new Set([
        ...Object.keys(allocations(old)),
        ...Object.keys(allocations(next)),
      ]),
    ];
    const snapshots = await Promise.all(
      ids.map(id =>
        transaction.get(recordRef(database, workspace, "materials", id))
      )
    );
    const materials = snapshots
      .filter(s => s.exists())
      .map(s => ({ ...s.data(), id: s.id }) as Material);
    const client = await transaction.get(
      recordRef(database, workspace, "clients", next.clientId)
    );
    if (!client.exists()) throw new Error("Cliente não encontrado.");
    if (next.vehicleId) {
      const vehicle = await transaction.get(
        recordRef(database, workspace, "vehicles", next.vehicleId)
      );
      if (!vehicle.exists() || vehicle.data().clientId !== next.clientId)
        throw new Error("Veículo não pertence ao cliente.");
    }
    for (const material of reserveMaterials(old, next, materials))
      transaction.update(
        recordRef(database, workspace, "materials", material.id),
        { availableGrams: material.availableGrams }
      );
    transaction.set(reference, safeRecord(next), { merge: true });
    // set(..., merge:true) recursively merges maps, resurrecting omitted keys.
    // update the field itself to replace the complete validated workflow map.
    if (next.workflow)
      transaction.update(reference, { workflow: safeRecord(next.workflow) });
    const eventId = makeId("event");
    transaction.set(recordRef(database, workspace, "calendar", eventId), {
      id: eventId,
      type: "order",
      title: `Documento salvo · ${next.title}`,
      detail: `${next.documentType} · ${next.clientName}`,
      date: new Date().toISOString(),
    });
    result = next;
  });
  if (!result) throw new Error("Não foi possível salvar o documento.");
  return result;
}
/** Retry-safe conversion. Both invoice creation and source link are committed together. */
export async function convertEstimateAtomic(
  database: Firestore,
  workspace: string,
  id: string,
  data: StudioData
): Promise<StudioOrder> {
  const newId = makeId("invoice");
  let result: StudioOrder | undefined;
  await runTransaction(database, async transaction => {
    const reference = recordRef(database, workspace, "orders", id);
    const source = await transaction.get(reference);
    if (!source.exists())
      throw new Error("Salve a estimativa antes de converter.");
    const saved = { ...source.data(), id: source.id } as StudioOrder;
    if (saved.documentType === "Invoice")
      throw new Error("O documento já é uma invoice.");
    if (
      saved.workflow &&
      ![
        "approved",
        "scheduled",
        "production",
        "quality",
        "delivered",
        "aftercare",
      ].includes(saved.workflow.stage)
    )
      throw new Error(
        "Aprove o orçamento pelo pipeline antes de converter em invoice."
      );
    if (saved.lines.some(line => line.pricePending))
      throw new Error("Precifique os serviços antes de converter em invoice.");
    if (saved.invoiceId) {
      const existing = await transaction.get(
        recordRef(database, workspace, "orders", saved.invoiceId)
      );
      if (existing.exists()) {
        result = { ...existing.data(), id: existing.id } as StudioOrder;
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
      {
        ...data,
        orders: [saved, ...data.orders.filter(order => order.id !== saved.id)],
      }
    );
    const ids = Object.keys(allocations(invoice));
    const snapshots = await Promise.all(
      ids.map(materialId =>
        transaction.get(recordRef(database, workspace, "materials", materialId))
      )
    );
    const materials = snapshots
      .filter(s => s.exists())
      .map(s => ({ ...s.data(), id: s.id }) as Material);
    for (const material of reserveMaterials(undefined, invoice, materials))
      transaction.update(
        recordRef(database, workspace, "materials", material.id),
        { availableGrams: material.availableGrams }
      );
    transaction.update(reference, { invoiceId: newId });
    transaction.set(
      recordRef(database, workspace, "orders", newId),
      safeRecord(invoice)
    );
    const eventId = makeId("event");
    transaction.set(recordRef(database, workspace, "calendar", eventId), {
      id: eventId,
      type: "order",
      title: "Estimativa convertida",
      detail: invoice.title,
      date: new Date().toISOString(),
    });
    result = invoice;
  });
  if (!result) throw new Error("Não foi possível converter.");
  return result;
}
/** Revision and both old/new part pointers have a single atomic commit. */
export async function saveRevisionAtomic(
  database: Firestore,
  workspace: string,
  input: PartRevision,
  data: StudioData
) {
  const revision = normalizeRecord("partRevisions", input, data);
  await runTransaction(database, async transaction => {
    const reference = recordRef(
      database,
      workspace,
      "partRevisions",
      revision.id
    );
    const previous = await transaction.get(reference);
    const targetRef = recordRef(database, workspace, "parts", revision.partId);
    const target = await transaction.get(targetRef);
    if (!target.exists()) throw new Error("Peça não encontrada.");
    const oldId = previous.data()?.partId;
    const old =
      oldId && oldId !== revision.partId
        ? await transaction.get(recordRef(database, workspace, "parts", oldId))
        : null;
    if (old?.exists() && old.data().currentRevisionId === revision.id)
      transaction.update(old.ref, { currentRevisionId: deleteField() });
    transaction.set(reference, safeRecord(revision), { merge: true });
    transaction.update(targetRef, { currentRevisionId: revision.id });
  });
}
