import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

function worker() {
  const listeners: Record<string, (event: unknown) => void> = {};
  const response = { ok: false };
  const fetch = vi.fn(async () => response);
  runInNewContext(
    readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8"),
    {
      self: {
        location: { origin: "https://reversoworks-gestor.github.io" },
        addEventListener: (
          name: string,
          callback: (event: unknown) => void
        ) => {
          listeners[name] = callback;
        },
      },
      fetch,
      URL,
      Set,
    }
  );
  async function request(
    destination: string,
    path = "/Gestor/",
    authorization = false
  ) {
    let result: Promise<unknown> | undefined;
    listeners.fetch({
      request: {
        url: `https://reversoworks-gestor.github.io${path}`,
        method: "GET",
        destination,
        headers: { has: () => authorization },
      },
      respondWith: (value: Promise<unknown>) => {
        result = value;
      },
    });
    if (result) await result;
  }
  return { fetch, request };
}

describe("atualização do aplicativo instalado", () => {
  it("revalida o HTML para não manter o cabeçalho anterior após atualizar", async () => {
    const { fetch, request } = worker();
    await request("document");
    expect(fetch).toHaveBeenCalledWith(expect.anything(), {
      cache: "no-cache",
    });
  });
  it("preserva cache normal de assets e não intercepta chamadas privadas", async () => {
    const { fetch, request } = worker();
    await request("script", "/Gestor/assets/index-hash.js");
    expect(fetch).toHaveBeenLastCalledWith(expect.anything(), {
      cache: "default",
    });
    fetch.mockClear();
    await request("", "/Gestor/api/records");
    await request("document", "/Gestor/", true);
    expect(fetch).not.toHaveBeenCalled();
  });
});
