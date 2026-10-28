// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { Timestamp } from "firebase/firestore";
import { demoData } from "../domain";
import type { GestorContext, StudioOrder } from "../types";
import CommercialPage from "./Commercial";

const { context } = vi.hoisted(() => ({
  context: { current: null as unknown as GestorContext },
}));
vi.mock("../store", () => ({
  useGestor: () => context.current,
  useOptionalGestor: () => context.current,
}));
afterEach(cleanup);

function setup(
  orders: StudioOrder[],
  view: GestorContext["view"] = "estimates"
) {
  const data = demoData();
  data.orders = orders;
  context.current = {
    data,
    settings: data.settings[0],
    view,
    mode: "demo",
    owner: true,
    loading: false,
    error: "",
    search: "",
    userName: "QA",
    setSearch: vi.fn(),
    navigate: vi.fn(),
    notify: vi.fn(),
    retry: vi.fn(),
    save: vi.fn(),
    remove: vi.fn(),
    saveOrder: vi.fn(),
    convertEstimate: vi.fn(),
    moveOrder: vi.fn(),
    moveMaterial: vi.fn(),
    saveRevision: vi.fn(),
    upload: vi.fn(),
    download: vi.fn(),
    removeFile: vi.fn(),
  };
}

function legacyOrders(): StudioOrder[] {
  const base = demoData().orders[0];
  return [
    {
      ...base,
      id: "missing",
      title: "Documento sem timestamp",
      documentType: "Estimativa",
      createdAt: undefined,
      updatedAt: undefined,
    },
    {
      ...base,
      id: "numeric",
      title: "Documento com época numérica",
      documentType: "Orçamento",
      createdAt: 1000,
      updatedAt: undefined,
    },
    {
      ...base,
      id: "firestore",
      title: "Documento com Timestamp",
      documentType: "Estimativa",
      createdAt: Timestamp.fromMillis(2000),
      updatedAt: undefined,
    },
    {
      ...base,
      id: "iso",
      title: "Documento ISO recente",
      documentType: "Estimativa",
      createdAt: "1970-01-01T00:00:03.000Z",
      updatedAt: undefined,
    },
  ] as unknown as StudioOrder[];
}

describe("documentos comerciais existentes", () => {
  it("abre estimativas com datas legadas e ordena sem ocultar registros", () => {
    setup(legacyOrders());
    render(<CommercialPage />);
    expect(screen.getByRole("heading", { name: "Estimativas" })).toBeTruthy();
    const titles = [...document.querySelectorAll("article.card strong")]
      .filter(e => !e.hasAttribute("aria-label"))
      .map(e => e.textContent);
    expect(titles).toEqual([
      "Documento ISO recente",
      "Documento com Timestamp",
      "Documento com época numérica",
      "Documento sem timestamp",
    ]);
    expect(context.current.saveOrder).not.toHaveBeenCalled();
  });
  it.each(["3d-printing", "constructor"])(
    "abre e edita serviço legado desconhecido %s",
    serviceType => {
      setup([
        {
          ...legacyOrders()[0],
          serviceType: serviceType as StudioOrder["serviceType"],
        },
      ]);
      context.current.search = "Documento";
      render(<CommercialPage />);
      expect(screen.getByText("Serviço: Serviço a definir")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Editar" }));
      expect(screen.getByRole("dialog")).toBeTruthy();
      expect(context.current.saveOrder).not.toHaveBeenCalled();
    }
  );
  it.each(["invoices", "orders"] as const)(
    "abre %s com timestamp ausente",
    view => {
      setup(
        legacyOrders().map(order => ({
          ...order,
          documentType: "Invoice",
          status: "Aprovado",
        })),
        view
      );
      render(<CommercialPage />);
      expect(document.querySelectorAll("article.card")).toHaveLength(4);
    }
  );
});
