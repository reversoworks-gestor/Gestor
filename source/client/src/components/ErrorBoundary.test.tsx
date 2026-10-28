// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import ErrorBoundary from "./ErrorBoundary";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("apresenta recuperação em português sem expor pilha ou detalhes do documento", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  function Broken(): never {
    throw new Error("private-record-name at /assets/Commercial.js:3112");
  }
  render(
    <ErrorBoundary>
      <Broken />
    </ErrorBoundary>
  );
  expect(
    screen.getByRole("heading", { name: "Não foi possível abrir esta página." })
  ).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Recarregar página" })
  ).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Voltar à visão geral" })
  ).toBeTruthy();
  expect(screen.queryByText(/private-record-name/)).toBeNull();
  expect(document.querySelector("pre")).toBeNull();
});
