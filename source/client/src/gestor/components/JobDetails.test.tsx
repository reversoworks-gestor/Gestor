// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { demoData } from "../domain";
import { createWorkflow } from "../jobWorkflow";
import { addOfficialLines } from "../serviceLines";
import JobDetails from "./JobDetails";

const mocked = vi.hoisted(() => ({ context: {} as any, save: vi.fn() }));
vi.mock("../store", () => ({
  useGestor: () => mocked.context,
  useOptionalGestor: () => mocked.context,
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
describe("registro de recebimentos na ficha operacional", () => {
  it("adiciona parcela manual, calcula saldo e preserva o pagamento ao salvar", async () => {
    const data = demoData();
    const order = {
      ...data.orders[0],
      id: "job-payment-ui",
      workflow: createWorkflow(["FAR-01"]),
      lines: addOfficialLines([], "FAR-01").map(line => ({
        ...line,
        unitPrice: 120,
        unitPriceCents: 12000,
        pricePending: false,
      })),
      total: 120,
      totalCents: 12000,
      payments: [],
    };
    order.workflow.quotedAmount = 120;
    order.workflow.finalAmount = 120;
    mocked.context = {
      data: { ...data, orders: [order] },
      owner: true,
      mode: "demo",
      settings: { currency: "USD" },
      saveOrder: mocked.save.mockResolvedValue(order),
      upload: vi.fn(),
      removeFile: vi.fn(),
      download: vi.fn(),
      navigate: vi.fn(),
    };
    render(<JobDetails order={order} onClose={vi.fn()} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Forma de pagamento"), "Cartão");
    await user.type(screen.getByLabelText("Data do pagamento"), "2026-11-05");
    await user.click(
      screen.getByText("Histórico e registro de recebimentos (0)")
    );
    await user.type(screen.getByLabelText("Valor deste recebimento"), "60");
    await user.click(
      screen.getByRole("button", { name: "Registrar recebimento ao salvar" })
    );
    await waitFor(() =>
      expect(
        screen.getByText("Histórico e registro de recebimentos (1)")
      ).toBeTruthy()
    );
    expect(
      screen.getByRole("button", { name: "Cancelar novo recebimento" })
    ).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Salvar job" }));
    await waitFor(() => expect(mocked.save).toHaveBeenCalledOnce());
    expect(mocked.save.mock.calls[0][0].payments).toEqual([
      expect.objectContaining({
        amount: 60,
        amountCents: 6000,
        method: "Cartão",
        date: "2026-11-05",
      }),
    ]);
  });
});
