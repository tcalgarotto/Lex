export type RankedList = Array<{ id: string; score?: number }>;

/** Reciprocal Rank Fusion k=60 */
export function reciprocalRankFusion(lists: RankedList[], k = 60): Map<string, number> {
  const scores = new Map<string, number>();
  for (const list of lists) {
    list.forEach((item, rank) => {
      const add = 1 / (k + rank + 1);
      scores.set(item.id, (scores.get(item.id) ?? 0) + add);
    });
  }
  return scores;
}
