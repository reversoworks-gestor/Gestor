import { afterEach, describe, expect, it, vi } from "vitest";
import { demoData } from "./domain";
import { createWorkflow, type JobWorkflow } from "./jobWorkflow";
import { prepareOrderSave } from "./repository";
import { findService } from "./serviceCatalog";
import type { StudioOrder } from "./types";

const initialToken = "2026-11-04T12:00:00.000Z";

function workflowOrder(workflow: JobWorkflow): StudioOrder {
  const base = demoData().orders[0];
  return {
    ...base,
    updatedAt: initialToken,
    documentType: "Orçamento",
    workflow: {
      ...workflow,
      quotedAmount: workflow.quotedAmount ?? workflow.serviceCodes.length * 100,
    },
    lines: workflow.serviceCodes.map(code => ({
      ...base.lines[0],
      id: `line-${code}`,
      serviceCode: code,
      label: findService(code)!.name,
      unitPrice: 100,
      pricePending: false,
    })),
  };
}

afterEach(() => vi.useRealTimers());

describe("order optimistic concurrency", () => {
  it("rejects the second stale editor even when both saves share a clock millisecond", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(initialToken));
    const data = demoData();
    const old = { ...data.orders[0], updatedAt: initialToken };
    data.orders = [old];
    const first = prepareOrderSave(
      { ...old, title: "Primeiro editor" },
      old,
      data
    );
    expect(first.updatedAt).toBe("2026-11-04T12:00:00.001Z");
    expect(() =>
      prepareOrderSave({ ...old, title: "Editor desatualizado" }, first, data)
    ).toThrow("alterado");
    expect(old.updatedAt).toBe(initialToken);
    expect(data.orders[0]).toBe(old);
  });

  it("allows the first edit of a legacy record without a token, then rejects tokenless collisions", () => {
    const data = demoData();
    const old = { ...data.orders[0], updatedAt: undefined };
    const first = prepareOrderSave(old, old, data);
    expect(first.updatedAt).toBeTruthy();
    expect(() => prepareOrderSave(old, first, data)).toThrow("alterado");
    expect(() =>
      prepareOrderSave(
        { ...old, title: "Colisão de ID novo" },
        data.orders[0],
        { ...data, orders: [] }
      )
    ).toThrow("alterado");
  });

  it("compares legacy server timestamps with their canonical client token", () => {
    const data = demoData();
    const input = { ...data.orders[0], updatedAt: initialToken };
    const milliseconds = Date.parse(initialToken);
    for (const value of [
      new Date(initialToken),
      milliseconds,
      String(milliseconds),
      { seconds: milliseconds / 1000, nanoseconds: 0 },
      { _seconds: milliseconds / 1000, _nanoseconds: 0 },
      { toDate: () => new Date(initialToken) },
      "2026-11-04T09:00:00-03:00",
    ]) {
      const old = { ...input, updatedAt: value } as unknown as StudioOrder;
      expect(() => prepareOrderSave(input, old, data)).not.toThrow();
    }
  });

  it("checks tokens before invalid draft fields can be normalized", () => {
    const data = demoData();
    const old = { ...data.orders[0], updatedAt: initialToken };
    expect(() =>
      prepareOrderSave({ ...old, updatedAt: undefined, title: "" }, old, data)
    ).toThrow("alterado");
  });

  it("does not overwrite a later payment ledger with a stale draft", () => {
    const data = demoData();
    const stale = {
      ...data.orders[0],
      updatedAt: initialToken,
      lines: data.orders[0].lines.map(line => ({
        ...line,
        unitPrice: 100,
        pricePending: false,
      })),
    };
    const saved = prepareOrderSave(
      {
        ...stale,
        payments: [
          { id: "receipt", amount: 20, method: "Cash", date: "2026-11-04" },
        ],
      },
      stale,
      data
    );
    expect(saved.payments).toHaveLength(1);
    expect(() =>
      prepareOrderSave({ ...stale, payments: [] }, saved, data)
    ).toThrow("alterado");
  });

  it("enforces append-only CAD against the actual record even when local history is shorter", () => {
    const data = demoData();
    const stale = workflowOrder({
      ...createWorkflow(["P3D-04"]),
      cadVersions: ["v1"],
    });
    const old = {
      ...stale,
      workflow: { ...stale.workflow!, cadVersions: ["v1", "v2"] },
    };
    data.orders = [stale];
    expect(() => prepareOrderSave(stale, old, data)).toThrow("append-only");
    const appended = prepareOrderSave(
      {
        ...old,
        workflow: { ...old.workflow, cadVersions: ["v1", "v2", "v3"] },
      },
      old,
      data
    );
    expect(appended.workflow?.cadVersions).toEqual(["v1", "v2", "v3"]);
    expect(data.orders[0].workflow?.cadVersions).toEqual(["v1"]);
  });

  it("preserves and validates an existing workflow when an edit omits its map", () => {
    const data = demoData();
    const old = workflowOrder({
      ...createWorkflow(["P3D-04"]),
      cadVersions: ["v1", "v2"],
    });
    const saved = prepareOrderSave({ ...old, workflow: undefined }, old, data);
    expect(saved.workflow?.cadVersions).toEqual(["v1", "v2"]);
  });

  it("uses the server stage instead of a local stage that would allow a skipped gate", () => {
    const data = demoData();
    const old = workflowOrder(createWorkflow(["DET-01"]));
    const ready = {
      ...old.workflow!,
      stage: "quote" as const,
      problem: "Avaliação registrada",
      quotedAmount: 100,
      estimatedDeadline: "2026-11-10",
      beforePhotos: [
        {
          name: "before.jpg",
          contentType: "image/jpeg",
          storagePath: "test/before.jpg",
        },
      ],
    };
    data.orders = [{ ...old, workflow: { ...ready, stage: "evaluation" } }];
    expect(() =>
      prepareOrderSave({ ...old, workflow: ready }, old, data)
    ).toThrow("uma etapa");
  });

  it("accepts a new-ID invoice clone with its validated source estimate stage", () => {
    const data = demoData();
    const source = workflowOrder({
      ...createWorkflow(["DET-01"]),
      stage: "approved",
      problem: "Avaliação registrada",
      quotedAmount: 100,
      estimatedDeadline: "2026-11-10",
      beforePhotos: [
        {
          name: "before.jpg",
          contentType: "image/jpeg",
          storagePath: "test/before.jpg",
        },
      ],
    });
    data.orders = [source];
    const invoice = prepareOrderSave(
      {
        ...source,
        id: "invoice-new",
        documentType: "Invoice",
        sourceEstimateId: source.id,
      },
      undefined,
      data
    );
    expect(invoice.workflow?.stage).toBe("approved");
    expect(invoice.sourceEstimateId).toBe(source.id);
  });

  it("returns the persisted invoice snapshot rather than a renamed client snapshot", () => {
    const data = demoData();
    const old = { ...data.orders[0], updatedAt: initialToken };
    data.clients[0].name = "Nome alterado depois";
    const result = prepareOrderSave(
      { ...old, clientSnapshot: undefined },
      old,
      data
    );
    expect(result.clientName).toBe("Cliente de demonstração");
    expect(result.clientSnapshot).toEqual(old.clientSnapshot);
  });
});
