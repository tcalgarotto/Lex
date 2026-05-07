import { describe, expect, it } from "vitest";
import { NormKind } from "@prisma/client";
import { classifyLegalIntent } from "./intent";
import {
  computeFinalScore,
  computeGroundingScore,
  groundingToConfidence,
} from "./scoring";
import type { ChunkWithLineage, LegalRetrievedChunk } from "./types";

function makeChunk(over: Partial<ChunkWithLineage> & {
  kind?: NormKind;
  structure?: ChunkWithLineage["structure"];
  publishedAt?: Date | null;
  urn?: string;
  articleRef?: string | null;
}): ChunkWithLineage {
  return {
    chunkId: "c1",
    text: "texto",
    fullPath: over.articleRef ?? null,
    structure: over.structure ?? "ARTIGO",
    articleRef: over.articleRef ?? null,
    contentHash: "h",
    versionId: "v1",
    validFrom: new Date("2020-01-01"),
    validTo: null,
    norm: {
      id: "n1",
      urn: over.urn ?? "urn:lex:br:federal:lei:1990-09-11;8078",
      kind: over.kind ?? NormKind.ORDINARY_LAW,
      jurisdiction: "FEDERAL",
      title: "CDC",
      identifier: "Lei 8078/1990",
      tribunal: null,
      publishedAt: over.publishedAt ?? new Date("1990-09-11"),
    },
    ...over,
  };
}

describe("computeFinalScore", () => {
  it("súmula vinculante recebe boost > 1", () => {
    const intent = classifyLegalIntent("súmula vinculante 14");
    const chunk = makeChunk({ kind: NormKind.SUMULA_VINCULANTE, urn: "urn:lex:br:supremo.tribunal.federal:sumula.vinculante:14" });
    const r = computeFinalScore({
      rerankScore: 0.5,
      rrfScore: 0.4,
      rawScores: { dense: 0.7, bm25: 0.3 },
      chunk,
      intent,
    });
    expect(r.breakdown.boost).toBeGreaterThan(1);
    expect(r.breakdown.final).toBeGreaterThan(0.5);
    expect(r.explanation).toContain("SUMULA_VINCULANTE");
  });

  it("estrutura GENERIC reduz boost", () => {
    const intent = classifyLegalIntent("conceito geral");
    const a = computeFinalScore({
      rerankScore: 0.5, rrfScore: 0.4, rawScores: {},
      chunk: makeChunk({ structure: "ARTIGO" }),
      intent,
    });
    const b = computeFinalScore({
      rerankScore: 0.5, rrfScore: 0.4, rawScores: {},
      chunk: makeChunk({ structure: "GENERIC" }),
      intent,
    });
    expect(b.breakdown.final).toBeLessThan(a.breakdown.final);
  });

  it("URN no intent eleva boost vs query genérica (mesma chunk)", () => {
    const intentMatch = classifyLegalIntent("o que diz a Lei nº 8.078, de 11 de setembro de 1990?");
    const intentNeutral = classifyLegalIntent("conceito doutrinário genérico");
    const chunk = makeChunk({ urn: intentMatch.urns[0]! });
    const a = computeFinalScore({
      rerankScore: 0.5, rrfScore: 0.4, rawScores: {}, chunk, intent: intentMatch,
    });
    const b = computeFinalScore({
      rerankScore: 0.5, rrfScore: 0.4, rawScores: {}, chunk, intent: intentNeutral,
    });
    expect(a.breakdown.boost ?? 0).toBeGreaterThan(b.breakdown.boost ?? 0);
    expect(a.breakdown.final).toBeGreaterThan(b.breakdown.final);
  });

  it("articleRef alinhado com intent recebe boost", () => {
    const intent = classifyLegalIntent("Art. 5º da CF/88");
    const r = computeFinalScore({
      rerankScore: 0.5, rrfScore: 0.4, rawScores: {},
      chunk: makeChunk({ articleRef: "Art. 5", urn: "urn:lex:br:federal:constituicao:1988-10-05;1988" }),
      intent,
    });
    expect(r.breakdown.boost).toBeGreaterThanOrEqual(1.15);
  });

  it("recência: publishedAt mais antigo reduz boost", () => {
    const intent = classifyLegalIntent("conceito");
    const recent = computeFinalScore({
      rerankScore: 0.5, rrfScore: 0.4, rawScores: {},
      chunk: makeChunk({ publishedAt: new Date(Date.now() - 30 * 86400000) }),
      intent,
    });
    const ancient = computeFinalScore({
      rerankScore: 0.5, rrfScore: 0.4, rawScores: {},
      chunk: makeChunk({ publishedAt: new Date("1900-01-01") }),
      intent,
    });
    expect(ancient.breakdown.final).toBeLessThan(recent.breakdown.final);
  });

  it("explanation legível com componentes", () => {
    const intent = classifyLegalIntent("teste");
    const r = computeFinalScore({
      rerankScore: 0.6, rrfScore: 0.5, rawScores: { dense: 0.8, bm25: 0.2 },
      chunk: makeChunk({}),
      intent,
    });
    expect(r.explanation).toContain("rerank=0.600");
    expect(r.explanation).toContain("boost=");
    expect(r.explanation).toContain("final=");
  });
});

describe("computeGroundingScore + groundingToConfidence", () => {
  function makeRet(score: number, urn = "urn:x"): LegalRetrievedChunk {
    return {
      chunkId: "c",
      text: "t",
      fullPath: null,
      structure: "ARTIGO",
      articleRef: null,
      norm: {
        id: "n",
        urn,
        kind: NormKind.ORDINARY_LAW,
        jurisdiction: "FEDERAL",
        title: "T",
        identifier: null,
        tribunal: null,
        publishedAt: null,
      },
      versionId: "v",
      validFrom: new Date(),
      validTo: null,
      scores: { final: score },
      provenance: ["dense"],
      explanation: "",
    };
  }

  it("zero chunks → grounding 0", () => {
    expect(computeGroundingScore({ chunks: [], intent: classifyLegalIntent("x") })).toBe(0);
  });

  it("top1 alto + diversidade → Alta", () => {
    const chunks = [makeRet(0.95, "u1"), makeRet(0.85, "u2"), makeRet(0.8, "u3")];
    const g = computeGroundingScore({ chunks, intent: classifyLegalIntent("x") });
    expect(g).toBeGreaterThan(0.6);
    const c = groundingToConfidence(g);
    expect(["Alta", "Média"]).toContain(c.label);
  });

  it("top1 baixo → Baixa", () => {
    const chunks = [makeRet(0.2)];
    const g = computeGroundingScore({ chunks, intent: classifyLegalIntent("x") });
    expect(groundingToConfidence(g).label).toBe("Baixa");
  });

  it("matching com intent.urns adiciona bônus", () => {
    const intent = classifyLegalIntent("o que diz a Lei nº 8.078, de 11 de setembro de 1990?");
    const target = intent.urns[0]!;
    const chunks = [makeRet(0.5, target)];
    const noIntent = computeGroundingScore({ chunks, intent: classifyLegalIntent("nada") });
    const withIntent = computeGroundingScore({ chunks, intent });
    expect(withIntent).toBeGreaterThan(noIntent);
  });
});
