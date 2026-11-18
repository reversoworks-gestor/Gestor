// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AutoCompleteField, type AutoCompleteOption } from "./AutoCompleteField";

const options: AutoCompleteOption[] = [
  { id: "c1", label: "Marcelo Cândido" },
  { id: "c2", label: "Dara" },
];

function Harness({ onUnmatched }: { onUnmatched: (text: string) => void }) {
  const [text, setText] = useState("");
  const [selected, setSelected] = useState("");
  return (
    <>
      <AutoCompleteField
        value={text}
        selectedId={selected}
        options={options}
        onTextChange={value => {
          setText(value);
          setSelected("");
        }}
        onSelect={option => {
          setText(option.label);
          setSelected(option.id);
        }}
        onUnmatched={onUnmatched}
      />
      <output data-testid="selected">{selected}</output>
      <button>outro</button>
    </>
  );
}
afterEach(cleanup);

describe("campo de texto com autocompletar", () => {
  it("sugere ao digitar, ignora acentos e seleciona ao tocar", async () => {
    const user = userEvent.setup();
    render(<Harness onUnmatched={vi.fn()} />);
    await user.type(screen.getByRole("combobox"), "marcelo c");
    await user.click(screen.getByRole("option", { name: /Marcelo Cândido/ }));
    expect(screen.getByTestId("selected").textContent).toBe("c1");
    expect(screen.getByRole("combobox")).toHaveProperty("value", "Marcelo Cândido");
  });

  it("aceita a sugestão com Enter", async () => {
    const user = userEvent.setup();
    render(<Harness onUnmatched={vi.fn()} />);
    await user.type(screen.getByRole("combobox"), "dar{Enter}");
    expect(screen.getByTestId("selected").textContent).toBe("c2");
  });

  it("pergunta o que fazer quando o texto não existe", async () => {
    const user = userEvent.setup();
    const unmatched = vi.fn();
    render(<Harness onUnmatched={unmatched} />);
    await user.type(screen.getByRole("combobox"), "Pedro Novo");
    await user.click(screen.getByText("outro"));
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(unmatched).toHaveBeenCalledWith("Pedro Novo");
  });
});
