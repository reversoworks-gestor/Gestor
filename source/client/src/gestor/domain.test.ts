import { describe, expect, it } from "vitest";
import {
  allocations,
  demoData,
  isRealDate,
  normalizeRecord,
  normalizeStudioOrder,
  reserveMaterials,
  safeDelete,
  safeRecord,
} from "./domain";

describe("Domínio automotivo do Gestor", () => {
  it("rejeita preço negativo no catálogo e aceita zero explícito", () => {
    const record = {
      id: "cat",
      name: "Faróis",
      description: "",
      unitPrice: -1,
      kind: "service" as const,
      taxable: false,
    };
    expect(() => normalizeRecord("catalogItems", record)).toThrow("Preço");
    expect(
      normalizeRecord("catalogItems", { ...record, unitPrice: 0 }).unitPrice
    ).toBe(0);
  });
  it("preserva nomes compostos e campos opcionais realmente vazios", () => {
    const client = demoData().clients[0];
    const output = normalizeRecord("clients", {
      ...client,
      firstName: "Ana Maria",
      lastName: "van der Meer",
      company: "",
    });
    expect(output.name).toBe("Ana Maria van der Meer");
    expect(output.lastName).toBe("van der Meer");
    expect(output.company).toBe("");
  });
  it.each([
    "2026-02-30",
    "2026-13-01",
    "0026-10-28",
    "2101-01-01",
    "2026-2-01",
  ])("rejeita data não real %s", date => expect(isRealDate(date)).toBe(false));
  it.each(["2024-02-29", "2026-10-28", "1900-01-01", "2100-12-31"])(
    "aceita data real %s",
    date => expect(isRealDate(date)).toBe(true)
  );
  it("bloqueia valores inválidos antes da normalização em centavos", () => {
    const data = demoData();
    const order = data.orders[0];
    expect(() =>
      normalizeStudioOrder(
        { ...order, lines: [{ ...order.lines[0], unitPrice: -1 }] },
        data
      )
    ).toThrow("Preço");
    expect(() =>
      normalizeStudioOrder(
        { ...order, lines: [{ ...order.lines[0], quantity: 0 }] },
        data
      )
    ).toThrow("Quantidade");
    expect(() =>
      normalizeStudioOrder(
        {
          ...order,
          payments: [
            {
              id: "p",
              date: order.startDate,
              method: "Cash",
              amount: Number.NaN,
            },
          ],
        },
        data
      )
    ).toThrow("pagamento");
  });
  it("recalcula centavos e impede pagamento acima do total", () => {
    const data = demoData();
    const order = {
      ...data.orders[0],
      lines: [
        {
          ...data.orders[0].lines[0],
          quantity: 3,
          unitPrice: 0.1,
          unitPriceCents: 999,
        },
      ],
    };
    expect(normalizeStudioOrder(order, data).totalCents).toBe(30);
    expect(() =>
      normalizeStudioOrder(
        {
          ...order,
          payments: [
            { id: "p", date: order.startDate, method: "Cash", amount: 1 },
          ],
        },
        data
      )
    ).toThrow("exceder");
  });
  it("bloqueia veículo de outro cliente", () => {
    const data = demoData();
    data.vehicles[0].clientId = "other";
    expect(() => normalizeStudioOrder(data.orders[0], data)).toThrow("veículo");
  });
  it("concilia reservas por material e devolve diferença ao reduzir", () => {
    const data = demoData(),
      m = data.materials[0];
    const old = { ...data.orders[0], materialId: m.id, materialGrams: 200 };
    const next = { ...old, materialGrams: 150 };
    expect(allocations(old)[m.id]).toBe(200);
    expect(
      reserveMaterials(old, next, [{ ...m, availableGrams: 800 }])[0]
        .availableGrams
    ).toBe(850);
  });
  it("não reserva estimativas e não permite saldo negativo", () => {
    const data = demoData(),
      m = data.materials[0];
    const order = { ...data.orders[0], materialId: m.id, materialGrams: 1001 };
    expect(() => reserveMaterials(undefined, order, [m])).toThrow(
      "insuficiente"
    );
    expect(allocations({ ...order, documentType: "Estimativa" })).toEqual({});
  });
  it("considera pesos de linhas e quantidade sem duplicar a reserva do cabeçalho", () => {
    const data = demoData(),
      m = data.materials[0];
    const order = {
      ...data.orders[0],
      materialId: m.id,
      materialGrams: 999,
      lines: [
        {
          ...data.orders[0].lines[0],
          materialId: m.id,
          weightGrams: 25,
          quantity: 2,
        },
      ],
    };
    expect(allocations(order)[m.id]).toBe(50);
  });
  it("rejeita entrega sem verificações completas", () => {
    const data = demoData();
    expect(() =>
      normalizeStudioOrder(
        { ...data.orders[0], completed: true, journeyStage: "check" },
        data
      )
    ).toThrow("entrega");
    expect(
      normalizeStudioOrder(
        {
          ...data.orders[0],
          completed: true,
          journeyStage: "check",
          finishApproved: true,
          fitApproved: true,
          clientApproved: true,
          inspectionNotes: "Inspeção concluída",
        },
        data
      ).completed
    ).toBe(true);
  });
  it("remove URLs bearer recursivamente sem alterar metadados nem objetos originais", () => {
    const input = {
      attachments: [
        {
          id: "f",
          downloadUrl: "secret",
          name: "file.pdf",
          storagePath: "workspaces/path",
        },
      ],
    };
    expect(safeRecord(input)).toEqual({
      attachments: [
        { id: "f", name: "file.pdf", storagePath: "workspaces/path" },
      ],
    });
    expect(input.attachments[0].downloadUrl).toBe("secret");
  });
  it("preserva vínculos e bloqueia exclusão de clientes usados", () =>
    expect(() => safeDelete("clients", "demo-client", demoData())).toThrow(
      "vinculado"
    ));
  it("não classifica automaticamente aplicação crítica como viável", () => {
    const record = {
      id: "a",
      serviceType: "engineering" as const,
      title: "Suporte",
      condition: "Trinca",
      objective: "Substituir",
      vehicleId: "",
      clientId: "",
      limitations: "",
      verdict: "Viável" as const,
      safetyCritical: true,
      photos: [],
      createdAt: new Date().toISOString(),
    };
    expect(() => normalizeRecord("triages", record)).toThrow("críticas");
  });
  it("rejeita configurações inválidas sem converter moeda", () => {
    const settings = demoData().settings[0];
    expect(() =>
      normalizeRecord("settings", { ...settings, taxRate: 1.01 })
    ).toThrow("Taxa");
    expect(
      normalizeRecord("settings", { ...settings, currency: "BRL" }).currency
    ).toBe("BRL");
  });
  it("preserva a moeda de catálogo legado quando o estúdio muda de moeda", () => {
    const data = demoData();
    const item = { ...data.catalogItems[0], unitPrice: 12.5 };
    data.catalogItems[0] = item;
    expect(
      normalizeRecord("catalogItems", { ...item, currency: "BRL" }, data)
        .currency
    ).toBe("USD");
  });
  it("fixa BRL em novo catálogo e aceita leitura sem contexto", () => {
    const item = {
      ...demoData().catalogItems[0],
      id: "new-brl",
      currency: "BRL" as const,
    };
    expect(normalizeRecord("catalogItems", item).currency).toBe("BRL");
  });
  it("rejeita total que perde precisão em centavos", () => {
    const data = demoData(),
      order = data.orders[0];
    expect(() =>
      normalizeStudioOrder(
        {
          ...order,
          lines: [{ ...order.lines[0], quantity: 1000, unitPrice: 1e13 }],
        },
        data
      )
    ).toThrow("precisão");
  });

  it("troca snapshot ao reassociar explicitamente uma invoice a outro cliente", () => {
    const data = demoData();
    const order = data.orders.find(o => o.documentType === "Invoice")!;
    const target = {
      ...data.clients[0],
      id: "other-client",
      name: "Cliente reassociado",
      firstName: "Cliente",
      lastName: "reassociado",
    };
    data.clients.push(target);
    const next = normalizeStudioOrder(
      { ...order, clientId: target.id, vehicleId: undefined },
      data
    );
    expect(next.clientName).toBe(target.name);
    expect(next.clientSnapshot?.name).toBe(target.name);
  });
});
