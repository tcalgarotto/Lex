/**
 * Fusão híbrida de candidatos (BM25 + dense, multi-query).
 *
 * Usa o `reciprocalRankFusion` existente, com k=60 (padrão sólido na
 * literatura para mistura sparse/dense).
 *
 * Resultado: lista única de chunkIds rankeada, preservando contadores
 * por origem para observabilidade e provenance.
 */

import { reciprocalRankFusion, type RankedList } from "@/lib/retrieval/rrf";
import type { ChunkWithLineage, RetrievalCandidate, RetrievalProvenance } from "./types";

export type FusedCandidate = {
  chunkId: string;
  /** Score RRF agregado entre todas as listas. */
  rrfScore: number;
  /** Origens que contribuíram (deduplicadas). */
  provenance: RetrievalProvenance[];
  /** Score bruto máximo por origem (pra observability). */
  rawScores: { dense?: number; bm25?: number };
};

/**
 * Faz a fusão de N listas heterogêneas. Cada lista é uma `Array<RetrievalCandidate>`
 * já ordenada (rank 0 = melhor). RRF normaliza ranks (sem normalizar scores).
 */
export function fuseCandidates(
  lists: RetrievalCandidate[][],
): FusedCandidate[] {
  if (lists.length === 0) return [];

  const ranked: RankedList[] = lists.map((list) =>
    list.map((c) => ({ id: c.chunkId, score: c.rawScore })),
  );
  const rrf = reciprocalRankFusion(ranked, 60);

  // Coleta provenance e rawScores
  const meta = new Map<string, { provenance: Set<RetrievalProvenance>; rawScores: { dense?: number; bm25?: number } }>();
  for (const list of lists) {
    for (const c of list) {
      const m = meta.get(c.chunkId) ?? { provenance: new Set(), rawScores: {} };
      m.provenance.add(c.source);
      if (c.source === "dense") {
        m.rawScores.dense = Math.max(m.rawScores.dense ?? 0, c.rawScore);
      } else if (c.source === "bm25") {
        m.rawScores.bm25 = Math.max(m.rawScores.bm25 ?? 0, c.rawScore);
      }
      meta.set(c.chunkId, m);
    }
  }

  return [...rrf.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([chunkId, rrfScore]) => {
      const m = meta.get(chunkId)!;
      return {
        chunkId,
        rrfScore,
        provenance: Array.from(m.provenance),
        rawScores: m.rawScores,
      };
    });
}

/**
 * Mescla N batches de `ChunkWithLineage` em um Map único pra lookup O(1).
 * Última ocorrência ganha (consideramos lineage idêntica).
 */
export function indexLineage(...batches: ChunkWithLineage[][]): Map<string, ChunkWithLineage> {
  const map = new Map<string, ChunkWithLineage>();
  for (const batch of batches) for (const c of batch) map.set(c.chunkId, c);
  return map;
}
