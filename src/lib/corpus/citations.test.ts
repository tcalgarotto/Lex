import { describe, expect, it } from "vitest";
import { CitationKind } from "@prisma/client";
import { extractCitations } from "./citations";

describe("extractCitations", () => {
  it("captura Lei com número/ano e com data por extenso", () => {
    const text = "A Lei nº 8.078/1990 e a Lei nº 8.078, de 11 de setembro de 1990 disciplinam o tema.";
    const out = extractCitations(text);
    const urns = out.map((c) => c.targetUrn);
    expect(urns).toContain("urn:lex:br:federal:lei:1990-09-11;8078");
  });

  it("captura Lei Complementar e LC abreviada", () => {
    const out1 = extractCitations("Lei Complementar nº 116/2003 ");
    expect(out1[0]!.targetUrn).toBe("urn:lex:br:federal:lei.complementar:2003-01-01;116");
    const out2 = extractCitations("Conforme LC 116/2003.");
    expect(out2[0]!.targetUrn).toBe("urn:lex:br:federal:lei.complementar:2003-01-01;116");
  });

  it("captura Decreto-Lei e Decreto", () => {
    const out = extractCitations("Decreto-Lei nº 2.848/1940 e Decreto nº 9.999/2019");
    const urns = out.map((c) => c.targetUrn);
    expect(urns).toContain("urn:lex:br:federal:decreto-lei:1940-01-01;2848");
    expect(urns).toContain("urn:lex:br:federal:decreto:2019-01-01;9999");
  });

  it("captura MP e EC", () => {
    const out = extractCitations("MP 1185/2023 e EC 132/2023");
    const urns = out.map((c) => c.targetUrn);
    expect(urns).toContain("urn:lex:br:federal:medida.provisoria:2023-01-01;1185");
    expect(urns).toContain("urn:lex:br:federal:emenda.constitucional:2023-01-01;132");
  });

  it("captura súmulas do STF e STJ", () => {
    const out = extractCitations(
      "Súmula Vinculante 14, Súmula 7 do STF e Súmula 511 do STJ",
    );
    const urns = out.map((c) => c.targetUrn);
    expect(urns).toContain(
      "urn:lex:br:supremo.tribunal.federal:sumula.vinculante:14",
    );
    expect(urns).toContain("urn:lex:br:supremo.tribunal.federal:sumula:7");
    expect(urns).toContain("urn:lex:br:superior.tribunal.justica:sumula:511");
  });

  it("captura códigos por alias canônico", () => {
    const text = "O CDC e o CC se aplicam, conforme a CF/88 e o CPC.";
    const out = extractCitations(text);
    const urns = out.map((c) => c.targetUrn);
    expect(urns).toContain("urn:lex:br:federal:lei:1990-09-11;8078");
    expect(urns).toContain("urn:lex:br:federal:lei:2002-01-10;10406");
    expect(urns).toContain("urn:lex:br:federal:constituicao:1988-10-05;1988");
    expect(urns).toContain("urn:lex:br:federal:lei:2015-03-16;13105");
  });

  it("é idempotente e dedupe por URN", () => {
    const text = "Lei 8078/1990 — Lei nº 8.078/1990 (CDC).";
    const out = extractCitations(text);
    const urns = out.map((c) => c.targetUrn);
    expect(urns.filter((u) => u === "urn:lex:br:federal:lei:1990-09-11;8078").length).toBe(1);
  });

  it("retorna lista vazia para texto sem citações", () => {
    expect(extractCitations("Apenas texto comum.")).toEqual([]);
  });

  it("kind é CITES por padrão", () => {
    const out = extractCitations("Lei nº 8.078/1990");
    expect(out[0]!.kind).toBe(CitationKind.CITES);
  });

  it("confidence > 0", () => {
    const out = extractCitations("Lei nº 8.078/1990");
    expect(out[0]!.confidence).toBeGreaterThan(0);
    expect(out[0]!.confidence).toBeLessThanOrEqual(1);
  });
});
