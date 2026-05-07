import { getEnv } from "@/lib/env";

type RerankDocument = { id: string; text: string };

/**
 * Rerank via DeepInfra OpenAI-compatible rerank endpoint quando disponível.
 * Se falhar, retorna a ordem original.
 */
export async function rerankDocuments(
  query: string,
  docs: RerankDocument[],
  topN: number,
): Promise<RerankDocument[]> {
  if (docs.length === 0) return [];
  const env = getEnv();
  const url = `${env.DEEPINFRA_BASE_URL.replace(/\/$/, "")}/rerank`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.DEEPINFRA_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "BAAI/bge-reranker-v2-m3",
        query,
        documents: docs.map((d) => d.text),
        top_n: Math.min(topN, docs.length),
      }),
    });
    if (!res.ok) return docs.slice(0, topN);
    const json = (await res.json()) as {
      results?: Array<{ index: number; relevance_score?: number }>;
    };
    const results = json.results;
    if (!results?.length) return docs.slice(0, topN);
    return results
      .map((r) => docs[r.index])
      .filter((d): d is RerankDocument => Boolean(d))
      .slice(0, topN);
  } catch {
    return docs.slice(0, topN);
  }
}
