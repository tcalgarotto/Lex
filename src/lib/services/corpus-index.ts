import { LegalLayer } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { chunkLegalText } from "@/lib/parsers/legal-chunker";
import { embedTexts } from "@/lib/ai/embeddings";
import { getQdrantVectorStore } from "@/lib/retrieval/vector-store/qdrant-store";
import { GLOBAL_WORKSPACE_ID } from "@/lib/constants";
import { sha256Hex } from "@/lib/util/content-hash";

export async function indexLegalSourcesToQdrant(sourceIds?: string[]): Promise<number> {
  const sources = await prisma.legalSource.findMany({
    where: sourceIds?.length ? { id: { in: sourceIds } } : undefined,
    take: 2000,
  });
  if (sources.length === 0) return 0;

  const store = getQdrantVectorStore();
  for (const src of sources) {
    const layer: LegalLayer = src.layer;
    const chunks = chunkLegalText(src.body, 2000, 200);
    if (chunks.length === 0) continue;
    const texts = chunks.map((c) => c.text);
    const vectors = await embedTexts(texts);
    const points = chunks.map((c, j) => {
      const contentHash = sha256Hex(c.text);
      return {
        id: randomUUID(),
        vector: vectors[j]!,
        payload: {
          workspaceId: GLOBAL_WORKSPACE_ID,
          layer,
          chunkText: c.text,
          section: c.section,
          contentHash,
          sourceCode: src.code,
          articleRef: src.articleRef ?? undefined,
          tribunal: src.tribunal ?? undefined,
        },
      };
    });
    await store.upsertPoints(points);
  }
  return sources.length;
}
