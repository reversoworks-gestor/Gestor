// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { Button, ConfirmButton, DateInput, Field, FormModal } from "./ui";

afterEach(cleanup);

describe("confirmações e modais aninhados", () => {
  it("confirmar exclusão não submete também o formulário pai", async () => {
    const save = vi.fn(async () => {}),
      remove = vi.fn(async () => {});
    render(
      <FormModal title="Editar peça" onClose={() => {}} onSubmit={save}>
        <ConfirmButton
          label="Excluir peça"
          confirmation="Remover?"
          onConfirm={remove}
        />
      </FormModal>
    );
    fireEvent.click(screen.getByRole("button", { name: "Excluir peça" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(remove).toHaveBeenCalledTimes(1));
    expect(save).not.toHaveBeenCalled();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });
  it("remover um registro fecha os dois modais sem deixar o conteúdo inerte", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <Button onClick={() => setOpen(true)}>Abrir evento</Button>
          {open && (
            <FormModal
              title="Editar evento"
              onClose={() => setOpen(false)}
              onSubmit={async () => {}}
            >
              <ConfirmButton
                label="Remover evento"
                confirmation="Remover?"
                onConfirm={async () => setOpen(false)}
              />
            </FormModal>
          )}
        </>
      );
    }
    const host = document.createElement("div");
    host.id = "root";
    host.inert = false;
    document.body.appendChild(host);
    const { unmount } = render(<Harness />, { container: host });
    fireEvent.click(screen.getByRole("button", { name: "Abrir evento" }));
    fireEvent.click(screen.getByRole("button", { name: "Remover evento" }));
    expect(host.inert).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(host.inert).toBe(false);
    expect(document.body.style.overflow).not.toBe("hidden");
    unmount();
    host.remove();
  });
  it("uma data impossível é inválida e informa o erro antes do salvamento", async () => {
    function Harness() {
      const [value, setValue] = useState("2026-02-31");
      return (
        <Field label="Data real">
          <DateInput value={value} onChange={e => setValue(e.target.value)} />
        </Field>
      );
    }
    render(<Harness />);
    const input = screen.getByLabelText("Data real") as HTMLInputElement;
    await waitFor(() => expect(input.checkValidity()).toBe(false));
    expect(screen.getByRole("alert").textContent).toContain("data real");
    fireEvent.change(input, { target: { value: "2026-02-28" } });
    await waitFor(() => expect(input.checkValidity()).toBe(true));
  });
});
