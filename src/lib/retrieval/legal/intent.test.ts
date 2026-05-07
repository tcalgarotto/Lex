import { describe, expect, it } from "vitest";
import { NormKind } from "@prisma/client";
import { classifyLegalIntent } from "./intent";

describe("classifyLegalIntent", () => {
  it("extrai URN, tribunal e referência a artigo", () => {
    const i = classifyLegalIntent(
      "Qual o entendimento do STJ sobre o art. 5º da CF/88 e a Súmula 511 do STJ?",
    );
    expect(i.urns).toContain("urn:lex:br:federal:constituicao:1988-10-05;1988");
    expect(i.urns).toContain("urn:lex:br:superior.tribunal.justica:sumula:511");
    expect(i.tribunals).toContain("STJ");
    expect(i.articleRefs).toContain("Art. 5");
    expect(i.signals).toContain("has_citations");
    expect(i.signals).toContain("tribunal_mentioned");
    expect(i.signals).toContain("article_ref");
  });

  it("detecta wantsSumula e prefersJurisprudence", () => {
    const i = classifyLegalIntent("Tem alguma súmula vinculante sobre acesso a investigação?");
    expect(i.wantsSumula).toBe(true);
    expect(i.preferredKinds).toContain(NormKind.SUMULA_VINCULANTE);
  });

  it("detecta tipo legislativo (CDC, MP, EC)", () => {
    const i = classifyLegalIntent("Qual o limite do CDC para cláusula abusiva, MP 1185/2023 e EC 132/2023?");
    expect(i.preferredKinds).toContain(NormKind.ORDINARY_LAW);
    expect(i.preferredKinds).toContain(NormKind.PROVISIONAL_MEASURE);
    expect(i.preferredKinds).toContain(NormKind.CONSTITUTIONAL_AMENDMENT);
  });

  it("detecta data 'vigente em DD/MM/YYYY'", () => {
    const i = classifyLegalIntent("Qual a redação vigente em 15/03/2024 do art. 49 do CDC?");
    expect(i.asOf?.toISOString().startsWith("2024-03-15")).toBe(true);
    expect(i.signals).toContain("asOf_date");
  });

  it("default: wantsCurrent=true quando não há asOf explícito", () => {
    const i = classifyLegalIntent("O que diz o CDC sobre direito de arrependimento?");
    expect(i.wantsCurrent).toBe(true);
    expect(i.asOf).toBeDefined();
  });

  it("query genérica sem termos jurídicos retorna intent neutro", () => {
    const i = classifyLegalIntent("Olá, como vai?");
    expect(i.urns.length).toBe(0);
    expect(i.tribunals.length).toBe(0);
    expect(i.preferredKinds.length).toBe(0);
  });

  it("preferredJurisdictions inclui FEDERAL para URN federal", () => {
    const i = classifyLegalIntent("Veja a Lei 8.078/1990");
    expect(i.preferredJurisdictions).toContain("FEDERAL");
  });

  it("preferredJurisdictions inclui COURT quando há tribunal", () => {
    const i = classifyLegalIntent("Decisão do STF sobre tema X");
    expect(i.preferredJurisdictions).toContain("COURT");
  });
});
