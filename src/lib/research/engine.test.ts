import { describe, expect, it } from "vitest";
import { NormKind } from "@prisma/client";
import {
  buildResearchReport,
  crossTribunalHeuristic,
  groupDominantTheses,
} from "./engine";
import type { LegalRetrievedChunk } from "@/lib/retrieval/legal/types";
import type { ContradictionRisk } from "@/lib/legal/reasoning/contradiction";

function mkChunk(p: Partial<LegalRetrievedChunk> & Pick<LegalRetrievedChunk, "chunkId" | "norm">): LegalRetrievedChunk {
  return {
    text: "texto de teste para o chunk jurídico.",
    fullPath: null,
    structure: "ARTIGO" as never,
    articleRef: null,
    versionId: "v",
    validFrom: new Date(),
    validTo: null,
    scores: {
      dense: 0.5,
      bm25: 0.5,
      rerank: 0.8,
      boost: 1,
      final: 0.85,
      breakdownJson: {},
    } as never,
    provenance: ["dense"],
    explanation: "test",
    ...p,
  };
}

describe("research engine", () => {
  it("agrupa por URN e ordena por dominantScore", () => {
    const urnA = "urn:lex:br:federal:lei:2002-01-10;10406";
    const urnB = "urn:lex:br:federal:constituicao:1988-10-05;1988";
    const chunks = [
      mkChunk({
        chunkId: "c1",
        norm: {
          id: "n1",
          urn: urnA,
          kind: NormKind.CODE,
          jurisdiction: "FEDERAL" as never,
          title: "CC",
          identifier: "CC",
          tribunal: null,
          publishedAt: null,
        },
        scores: { dense: 0.5, bm25: 0.5, rerank: 0.9, boost: 1, final: 0.9, breakdownJson: {} } as never,
      }),
      mkChunk({
        chunkId: "c2",
        norm: {
          id: "n2",
          urn: urnB,
          kind: NormKind.CONSTITUTION,
          jurisdiction: "FEDERAL" as never,
          title: "CF",
          identifier: "CF/88",
          tribunal: null,
          publishedAt: null,
        },
        scores: { dense: 0.5, bm25: 0.5, rerank: 0.95, boost: 1, final: 0.95, breakdownJson: {} } as never,
      }),
      mkChunk({
        chunkId: "c3",
        norm: {
          id: "n1b",
          urn: urnA,
          kind: NormKind.CODE,
          jurisdiction: "FEDERAL" as never,
          title: "CC",
          identifier: "CC",
          tribunal: null,
          publishedAt: null,
        },
        scores: { dense: 0.4, bm25: 0.4, rerank: 0.7, boost: 1, final: 0.7, breakdownJson: {} } as never,
      }),
    ];
    const g = groupDominantTheses(chunks);
    expect(g.length).toBe(2);
    expect(g[0]!.anchorUrn).toBe(urnB);
    expect(g[0]!.chunkIds.length).toBe(1);
    expect(g[1]!.chunkIds.length).toBe(2);
  });

  it("crossTribunalHeuristic detecta dois superiores no mesmo artigo", () => {
    const chunks = [
      mkChunk({
        chunkId: "a",
        articleRef: "Art. 5º",
        norm: {
          id: "x",
          urn: "u1",
          kind: NormKind.JURISPRUDENCE_STF as never,
          jurisdiction: "FEDERAL" as never,
          title: "x",
          identifier: null,
          tribunal: "STF",
          publishedAt: null,
        },
      }),
      mkChunk({
        chunkId: "b",
        articleRef: "Art. 5º",
        norm: {
          id: "y",
          urn: "u2",
          kind: NormKind.JURISPRUDENCE_STJ as never,
          jurisdiction: "FEDERAL" as never,
          title: "y",
          identifier: null,
          tribunal: "STJ",
          publishedAt: null,
        },
      }),
    ];
    const div = crossTribunalHeuristic(chunks);
    expect(div.length).toBeGreaterThanOrEqual(1);
    expect(div[0]!.tribunalsInvolved.sort()).toEqual(["STF", "STJ"].sort());
  });

  it("buildResearchReport inclui consolidado", () => {
    const urn = "urn:test";
    const chunks = [
      mkChunk({
        chunkId: "c1",
        norm: {
          id: "n",
          urn,
          kind: NormKind.CODE,
          jurisdiction: "FEDERAL" as never,
          title: "Lei X",
          identifier: "Lei 1/2000",
          tribunal: null,
          publishedAt: null,
        },
      }),
    ];
    const contra: ContradictionRisk[] = [
      {
        id: "r1",
        severity: "media",
        title: "Divergência entre tribunais",
        detail: "STF e STJ divergem.",
        evidence: { chunkIds: [], normUrns: [] },
      },
    ];
    const rep = buildResearchReport({
      chunks,
      filters: { tribunals: ["TJSP"] },
      contradictions: contra,
    });
    expect(rep.thesisGroups.length).toBe(1);
    expect(rep.divergences.some((d) => d.source === "contradiction_layer")).toBe(true);
    expect(rep.consolidated.thesisCount).toBe(1);
    expect(rep.filtersApplied.tribunals).toEqual(["TJSP"]);
  });
});
