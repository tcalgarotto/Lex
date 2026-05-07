import { describe, expect, it } from "vitest";
import {
  computeTribunalFavorability,
  detectEvidenceGaps,
  summarizeContradictionSeverity,
} from "./strategic";
import type { ContradictionRisk } from "@/lib/legal/reasoning/contradiction";
import type { LegalRetrievedChunk } from "@/lib/retrieval/legal/types";
import { NormKind } from "@prisma/client";

function mkChunk(tribunal: string | null, score: number): LegalRetrievedChunk {
  return {
    chunkId: `c-${tribunal}-${score}`,
    text: "ementa",
    fullPath: null,
    structure: "EMENTA" as never,
    articleRef: null,
    norm: {
      id: "n",
      urn: "urn:x",
      kind: NormKind.JURISPRUDENCE_STF,
      jurisdiction: "COURT",
      title: "t",
      identifier: null,
      tribunal,
      publishedAt: null,
    },
    versionId: "v",
    validFrom: new Date(),
    validTo: null,
    scores: {
      dense: 0.5,
      bm25: 0.5,
      rerank: score,
      boost: 1,
      final: score,
      breakdownJson: {},
    } as never,
    provenance: ["dense"],
    explanation: "x",
  };
}

describe("strategic reasoning", () => {
  it("detectEvidenceGaps quando overlap baixo", () => {
    const gaps = detectEvidenceGaps({
      factTexts: ["Fato completamente alheio ao corpus xyzabc"],
      chunks: [
        mkChunk("STF", 0.9),
      ],
    });
    expect(gaps.some((g) => g.gapKind === "keyword_overlap_low")).toBe(true);
  });

  it("computeTribunalFavorability alinhado", () => {
    const chunks = [mkChunk("TJSP", 0.8), mkChunk("TJSP", 0.7)];
    const f = computeTribunalFavorability({ chunks, targetTribunal: "TJSP" });
    expect(f.verdict).toBe("alinhado");
    expect(f.alignmentScore).toBeGreaterThan(0.3);
  });

  it("summarizeContradictionSeverity conta severidades", () => {
    const risks: ContradictionRisk[] = [
      { id: "1", severity: "alta", title: "a", detail: "d", evidence: { chunkIds: [], normUrns: [] } },
      { id: "2", severity: "media", title: "b", detail: "d", evidence: { chunkIds: [], normUrns: [] } },
    ];
    const s = summarizeContradictionSeverity(risks);
    expect(s.alta).toBe(1);
    expect(s.media).toBe(1);
    expect(s.baixa).toBe(0);
  });
});
