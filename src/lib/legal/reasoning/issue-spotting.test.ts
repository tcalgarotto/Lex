import { describe, expect, it } from "vitest";
import { NormKind } from "@prisma/client";
import { classifyLegalIntent } from "@/lib/retrieval/legal/intent";
import type { LegalRetrievedChunk } from "@/lib/retrieval/legal/types";
import { spotLegalIssues } from "./issue-spotting";

function chunk(over: Partial<LegalRetrievedChunk> & {
  text?: string;
  urn?: string;
  kind?: NormKind;
  identifier?: string;
}): LegalRetrievedChunk {
  return {
    chunkId: `c-${Math.random().toString(36).slice(2, 7)}`,
    text: over.text ?? "",
    fullPath: null,
    structure: "ARTIGO",
    articleRef: null,
    norm: {
      id: "n",
      urn: over.urn ?? "urn:lex:br:federal:lei:2002-01-10;10406",
      kind: over.kind ?? NormKind.ORDINARY_LAW,
      jurisdiction: "FEDERAL",
      title: "T",
      identifier: over.identifier ?? null,
      tribunal: null,
      publishedAt: new Date("2002-01-10"),
    },
    versionId: "v",
    validFrom: new Date(),
    validTo: null,
    scores: { final: 0.7 },
    provenance: ["dense"],
    explanation: "",
    ...over,
  };
}

describe("spotLegalIssues", () => {
  it("detecta consumo quando query menciona CDC e norma é Lei 8078", () => {
    const intent = classifyLegalIntent("o que diz o CDC sobre cláusula abusiva?");
    const chunks = [
      chunk({
        text: "Art. 51. São nulas de pleno direito as cláusulas abusivas...",
        urn: "urn:lex:br:federal:lei:1990-09-11;8078",
      }),
    ];
    const issues = spotLegalIssues({ query: "CDC cláusula abusiva", intent, chunks });
    expect(issues.find((i) => i.id === "consumo")).toBeDefined();
    const i = issues.find((i) => i.id === "consumo")!;
    expect(i.confidence).toBeGreaterThanOrEqual(0.75);
    expect(i.evidence.length).toBeGreaterThan(0);
    expect(i.rationale).toContain("termos-gatilho");
  });

  it("detecta direito fundamental quando query cita CF/88 e chunk traz Art. 5º", () => {
    const intent = classifyLegalIntent("Art. 5º da CF/88");
    const chunks = [
      chunk({
        text: "Art. 5º Todos são iguais perante a lei...",
        urn: "urn:lex:br:federal:constituicao:1988-10-05;1988",
        kind: NormKind.CONSTITUTION,
      }),
    ];
    const issues = spotLegalIssues({ query: "Art. 5º da CF/88", intent, chunks });
    expect(issues.find((i) => i.id === "direito-fundamental")).toBeDefined();
  });

  it("não confunde tema: query sem termos-gatilho não retorna nada", () => {
    const intent = classifyLegalIntent("olá");
    const issues = spotLegalIssues({ query: "olá", intent, chunks: [] });
    expect(issues.length).toBe(0);
  });

  it("captura múltiplos issues na mesma query", () => {
    const intent = classifyLegalIntent("prescrição na ação consumerista do CDC");
    const issues = spotLegalIssues({
      query: "prescrição na ação consumerista do CDC",
      intent,
      chunks: [chunk({ text: "Art. 27. Prescreve em cinco anos a pretensão à reparação..." })],
    });
    const ids = issues.map((i) => i.id);
    expect(ids).toContain("prescricao-decadencia");
    expect(ids).toContain("consumo");
  });

  it("limita a 8 issues no máximo", () => {
    const longQuery =
      "responsabilidade civil dano moral consumidor cláusula abusiva prescrição decadência tutela urgência liminar improbidade administrativa CLT vínculo empregatício imposto contribuição prequestionamento devido processo competência";
    const intent = classifyLegalIntent(longQuery);
    const issues = spotLegalIssues({ query: longQuery, intent, chunks: [] });
    expect(issues.length).toBeLessThanOrEqual(8);
  });

  it("ordena por confidence decrescente", () => {
    const intent = classifyLegalIntent("CDC consumidor prescrição");
    const issues = spotLegalIssues({ query: "CDC consumidor prescrição", intent, chunks: [] });
    for (let i = 1; i < issues.length; i++) {
      expect(issues[i - 1]!.confidence).toBeGreaterThanOrEqual(issues[i]!.confidence);
    }
  });
});
