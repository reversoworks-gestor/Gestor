import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase/firestore";
import { newestFirst, timestampIso, timestampMillis } from "./recordDates";
import { loadLegacy } from "./domain";

describe("timestamps de documentos existentes", () => {
  it.each([
    ["2021-01-01T00:00:00.000Z", 1609459200000],
    [1609459200000, 1609459200000],
    ["1609459200000", 1609459200000],
    [new Date("2021-01-01T00:00:00.000Z"), 1609459200000],
    [Timestamp.fromMillis(1609459200000), 1609459200000],
    [{ seconds: 1609459200, nanoseconds: 0 }, 1609459200000],
    [{ _seconds: 1609459200, _nanoseconds: 0 }, 1609459200000],
    [{ toDate: () => new Date(1609459200000) }, 1609459200000],
    [0, 0],
  ])(
    "aceita um timestamp válido sem alterar sua origem",
    (source, expected) => {
      expect(timestampMillis(source)).toBe(expected);
    }
  );
  it.each([
    undefined,
    null,
    "",
    "data inválida",
    {},
    NaN,
    Infinity,
    new Date(NaN),
    { seconds: NaN },
    { seconds: 1, nanoseconds: -1 },
    {
      toMillis: () => {
        throw new Error("invalid");
      },
    },
  ])("mantém valor inválido fora da ordenação", value => {
    expect(timestampMillis(value)).toBeNull();
    expect(timestampIso(value)).toBeUndefined();
  });
  it("usa criação quando a atualização não tem data válida, e mantém registros sem data", () => {
    const records = [
      { id: "missing" },
      { id: "epoch", createdAt: 0 },
      { id: "older", createdAt: 1000 },
      { id: "recent", createdAt: 2000, updatedAt: "inválida" },
    ];
    expect([...records].sort(newestFirst).map(x => x.id)).toEqual([
      "recent",
      "older",
      "epoch",
      "missing",
    ]);
    expect(records.map(x => x.id)).toEqual([
      "missing",
      "epoch",
      "older",
      "recent",
    ]);
  });
  it("converte timestamps na leitura sem alterar o documento remoto original", () => {
    const createdAt = Timestamp.fromMillis(1609459200000);
    const source = {
      id: "legacy",
      createdAt,
      updatedAt: { seconds: 1609459260, nanoseconds: 0 },
      title: "Original",
      total: 45,
    };
    const loaded = loadLegacy("orders", source);
    expect(loaded.createdAt).toBe("2021-01-01T00:00:00.000Z");
    expect(loaded.updatedAt).toBe("2021-01-01T00:01:00.000Z");
    expect(loaded.total).toBe(45);
    expect(source.createdAt).toBe(createdAt);
    expect(source.updatedAt).toEqual({ seconds: 1609459260, nanoseconds: 0 });
  });
});
