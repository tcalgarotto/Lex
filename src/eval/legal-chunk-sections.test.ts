import { describe, expect, it } from "vitest";
import { chunkLegalText } from "@/lib/parsers/legal-chunker";

describe("legal chunker semântico", () => {
  it("detecta seções típicas de petição", () => {
    const raw = `
DOS FATOS

A parte autora contratou serviços.

DO DIREITO

O Código Civil dispõe sobre o tema.

Art. 389. O devedor responde por perdas e danos.

DOS PEDIDOS

Requer-se a procedência.

DISPOSITIVO

Ante o exposto, requer-se julgamento procedente.
`;
    const chunks = chunkLegalText(raw, 800, 80);
    const sections = new Set(chunks.map((c) => c.section));
    expect(sections.has("facts")).toBe(true);
    expect(sections.has("legal_reasoning")).toBe(true);
    expect(sections.has("requests")).toBe(true);
    expect(sections.has("dispositive")).toBe(true);
  });

  it("marca trechos por artigo como article_norm quando seção genérica", () => {
    const raw = "Art. 1º. Texto.\n\nArt. 2º. Mais texto.";
    const chunks = chunkLegalText(raw, 500, 50);
    expect(chunks.some((c) => c.section === "article_norm")).toBe(true);
  });
});
