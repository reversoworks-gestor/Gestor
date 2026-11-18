import { describe, expect, it } from "vitest";
import { fillTemplate, messageTemplates, whatsappLink } from "./messageTemplates";

describe("modelos de mensagem", () => {
  it("preenche campos e mantém os vazios visíveis", () => {
    const text = fillTemplate("Hi {name}, your {vehicle} on {day}.", {
      name: "Maria",
      vehicle: "  ",
    });
    expect(text).toBe("Hi Maria, your [vehicle] on [day].");
  });
  it("todos os modelos têm id único e texto em inglês sem acentos de português", () => {
    const ids = new Set(messageTemplates.map(t => t.id));
    expect(ids.size).toBe(messageTemplates.length);
    for (const t of messageTemplates) expect(t.body).not.toMatch(/[ãõçáéíóú]/i);
  });
  it("não inventa preço, prazo ou garantia", () => {
    for (const t of messageTemplates)
      expect(t.body).not.toMatch(/warranty|guarantee|\$\d/i);
  });
  it("gera link do WhatsApp com código dos EUA para número de 10 dígitos", () => {
    expect(whatsappLink("(510) 555-1234", "Hi there")).toBe(
      "https://wa.me/15105551234?text=Hi%20there"
    );
    expect(whatsappLink("", "x")).toBe("");
  });
});
