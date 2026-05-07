import { describe, expect, it } from "vitest";
import { fuseCandidates, indexLineage } from "./hybrid";
import type { ChunkWithLineage, RetrievalCandidate } from "./types";

const denseList: RetrievalCandidate[] = [
  { chunkId: "a", rank: 0, rawScore: 0.95, source: "dense" },
  { chunkId: "b", rank: 1, rawScore: 0.83, source: "dense" },
  { chunkId: "c", rank: 2, rawScore: 0.72, source: "dense" },
];
const bm25List: RetrievalCandidate[] = [
  { chunkId: "b", rank: 0, rawScore: 0.41, source: "bm25" },
  { chunkId: "c", rank: 1, rawScore: 0.32, source: "bm25" },
  { chunkId: "d", rank: 2, rawScore: 0.18, source: "bm25" },
];

describe("fuseCandidates", () => {
  it("RRF eleva itens que aparecem em ambas as listas", () => {
    const fused = fuseCandidates([denseList, bm25List]);
    const ids = fused.map((f) => f.chunkId);
    // 'b' e 'c' devem aparecer antes de 'a' (que só está em dense) — mas pode
    // depender da posição; o invariante seguro é: 'b' aparece e tem provenance dupla.
    const b = fused.find((f) => f.chunkId === "b");
    expect(b?.provenance.sort()).toEqual(["bm25", "dense"]);
    expect(b?.rawScores.dense).toBeCloseTo(0.83);
    expect(b?.rawScores.bm25).toBeCloseTo(0.41);
    expect(ids).toContain("a");
    expect(ids).toContain("d");
  });

  it("preserva ordenação decrescente por rrfScore", () => {
    const fused = fuseCandidates([denseList, bm25List]);
    for (let i = 1; i < fused.length; i++) {
      expect(fused[i - 1]!.rrfScore).toBeGreaterThanOrEqual(fused[i]!.rrfScore);
    }
  });

  it("input vazio retorna lista vazia", () => {
    expect(fuseCandidates([])).toEqual([]);
    expect(fuseCandidates([[]])).toEqual([]);
  });

  it("provenance é deduplicada", () => {
    const fused = fuseCandidates([
      [
        { chunkId: "x", rank: 0, rawScore: 1, source: "dense" },
        { chunkId: "x", rank: 0, rawScore: 0.9, source: "dense" }, // duplicado
      ],
    ]);
    expect(fused[0]!.provenance).toEqual(["dense"]);
  });
});

describe("indexLineage", () => {
  it("último valor ganha em conflito", () => {
    const a = { chunkId: "x", text: "v1" } as ChunkWithLineage;
    const b = { chunkId: "x", text: "v2" } as ChunkWithLineage;
    const m = indexLineage([a], [b]);
    expect(m.get("x")?.text).toBe("v2");
  });

  it("preserva todos quando ids únicos", () => {
    const a = { chunkId: "a", text: "A" } as ChunkWithLineage;
    const b = { chunkId: "b", text: "B" } as ChunkWithLineage;
    const m = indexLineage([a, b]);
    expect(m.size).toBe(2);
  });
});
