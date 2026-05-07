import { describe, expect, it } from "vitest";
import { NormKind } from "@prisma/client";
import { classifyLegalIntent } from "@/lib/retrieval/legal/intent";
import type { LegalRetrievedChunk } from "@/lib/retrieval/legal/types";
import { synthesizeStrategy } from "./strategy";
import type { ContradictionRisk } from "./contradiction";
import type { LegalIssue } from "./issue-spotting";

function chunk(o: Partial<LegalRetrievedChunk> & { score?: number; urn?: string; identifier?: string; kind?: NormKind }): LegalRetrievedChunk {
  return {
    chunkId: `c-${Math.random().toString(36).slice(2, 7)}`,
    text: o.text ?? "Texto do chunk relevante para a tese.",
    fullPath: o.fullPath ?? "Art. 5º",
    structure: "ARTIGO",
    articleRef: "Art. 5",
    norm: {
      id: "n",
      urn: o.urn ?? "urn:lex:br:federal:constituicao:1988-10-05;1988",
      kind: o.kind ?? NormKind.CONSTITUTION,
      jurisdiction: "FEDERAL",
      title: "CF/88",
      identifier: o.identifier ?? "CF/1988",
      tribunal: null,
      publishedAt: new Date("1988-10-05"),
    },
    versionId: "v",
    validFrom: new Date(),
    validTo: null,
    scores: { final: o.score ?? 0.8 },
    provenance: ["dense"],
    explanation: "",
    ...o,
  };
}

const baseIssues: LegalIssue[] = [
  {
    id: "direito-fundamental",
    title: "Direito fundamental (CF/88)",
    category: "constitucional",
    confidence: 0.8,
    evidence: [],
    rationale: "termos na query",
  },
];

const baseRisks: ContradictionRisk[] = [];

describe("synthesizeStrategy", () => {
  it("constrói tese a partir do top chunk + primary issue", () => {
    const intent = classifyLegalIntent("Art. 5º da CF/88 direito fundamental");
    const result = synthesizeStrategy({
      query: "Art. 5º da CF/88",
      intent,
      chunks: [chunk({})],
      issues: baseIssues,
      risks: baseRisks,
    });
    expect(result.thesis).toContain("Direito fundamental");
    expect(result.thesis).toContain("CF/1988");
    expect(result.arguments.length).toBeGreaterThan(0);
    expect(result.arguments[0]!.headline).toMatch(/Fundamento central/);
  });

  it("respeita limite de 4 argumentos (deduplicando por norma)", () => {
    const intent = classifyLegalIntent("X");
    const cs = Array.from({ length: 8 }, (_, i) =>
      chunk({ urn: `urn:test:${i}`, identifier: `Lei ${i}` }),
    );
    const result = synthesizeStrategy({
      query: "X",
      intent,
      chunks: cs,
      issues: [],
      risks: [],
    });
    expect(result.arguments.length).toBeLessThanOrEqual(4);
  });

  it("não duplica argumentos da mesma norma", () => {
    const intent = classifyLegalIntent("X");
    const cs = [chunk({ urn: "u-1" }), chunk({ urn: "u-1" }), chunk({ urn: "u-2" })];
    const result = synthesizeStrategy({ query: "X", intent, chunks: cs, issues: [], risks: [] });
    const norms = result.arguments.flatMap((a) => a.evidence.normUrns);
    expect(new Set(norms).size).toBe(norms.length);
  });

  it("converte risks em counter-arguments", () => {
    const intent = classifyLegalIntent("X");
    const risks: ContradictionRisk[] = [
      { id: "r1", severity: "alta", title: "Norma revogada", detail: "...", evidence: { chunkIds: [], normUrns: [] } },
    ];
    const result = synthesizeStrategy({ query: "X", intent, chunks: [chunk({})], issues: [], risks });
    expect(result.counterArguments[0]!.severity).toBe("alta");
    expect(result.counterArguments[0]!.headline).toBe("Norma revogada");
  });

  it("gera nextSteps coerentes com intent (petição → minuta)", () => {
    const intent = classifyLegalIntent("gerar petição inicial sobre CDC");
    const result = synthesizeStrategy({
      query: "gerar petição inicial",
      intent,
      chunks: [chunk({ kind: NormKind.ORDINARY_LAW, urn: "urn:cdc" })],
      issues: [],
      risks: [],
    });
    expect(result.nextSteps.some((s) => s.toLowerCase().includes("minuta"))).toBe(true);
  });

  it("badge sumariza arg + issue + risk", () => {
    const intent = classifyLegalIntent("X");
    const result = synthesizeStrategy({
      query: "X",
      intent,
      chunks: [chunk({})],
      issues: baseIssues,
      risks: [
        { id: "r1", severity: "media", title: "Divergência STF/STJ", detail: "...", evidence: { chunkIds: [], normUrns: [] } },
      ],
    });
    expect(result.badge).toMatch(/argumento/);
    expect(result.badge).toMatch(/issue/);
    expect(result.badge).toMatch(/risco/);
  });

  it("query sem chunks: tese cai no fallback do query string", () => {
    const intent = classifyLegalIntent("y");
    const result = synthesizeStrategy({
      query: "qualquer dúvida jurídica",
      intent,
      chunks: [],
      issues: [],
      risks: [],
    });
    expect(result.arguments.length).toBe(0);
    expect(result.thesis).toBeTruthy();
  });
});
