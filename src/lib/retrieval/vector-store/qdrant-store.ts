import { QdrantClient } from "@qdrant/js-client-rest";
import type { LegalLayer } from "@prisma/client";
import { getEnv } from "@/lib/env";
import type { VectorPayload, VectorSearchHit, VectorStore } from "@/lib/retrieval/vector-store/types";

function client(): QdrantClient {
  const env = getEnv();
  return new QdrantClient({
    url: env.QDRANT_URL,
    apiKey: env.QDRANT_API_KEY || undefined,
  });
}

function collection(): string {
  return getEnv().QDRANT_COLLECTION;
}

export class QdrantVectorStore implements VectorStore {
  async upsertPoints(
    points: Array<{ id: string; vector: number[]; payload: VectorPayload }>,
  ): Promise<void> {
    if (points.length === 0) return;
    const c = client();
    const col = collection();
    await c.upsert(col, {
      wait: true,
      points: points.map((p) => ({
        id: p.id,
        vector: p.vector,
        payload: {
          workspaceId: p.payload.workspaceId,
          layer: p.payload.layer,
          chunkText: p.payload.chunkText,
          section: p.payload.section ?? null,
          contentHash: p.payload.contentHash ?? null,
          documentId: p.payload.documentId ?? null,
          processId: p.payload.processId ?? null,
          pieceId: p.payload.pieceId ?? null,
          sourceCode: p.payload.sourceCode ?? null,
          articleRef: p.payload.articleRef ?? null,
          tribunal: p.payload.tribunal ?? null,
        },
      })),
    });
  }

  async search(params: {
    vector: number[];
    workspaceIds: string[];
    layers?: LegalLayer[];
    limit: number;
  }): Promise<VectorSearchHit[]> {
    const c = client();
    const col = collection();
    const must: Array<Record<string, unknown>> = [
      {
        key: "workspaceId",
        match: { any: params.workspaceIds },
      },
    ];
    if (params.layers?.length) {
      must.push({
        key: "layer",
        match: { any: params.layers },
      });
    }
    const res = await c.search(col, {
      vector: params.vector,
      limit: params.limit,
      filter: { must },
      with_payload: true,
    });
    return res.map((r) => ({
      id: String(r.id),
      score: typeof r.score === "number" ? r.score : 0,
      payload: r.payload as unknown as VectorPayload,
    }));
  }

  /**
   * Deleta vetores de um documento dentro do workspace informado.
   *
   * `workspaceId` é obrigatório por segurança: o filtro Qdrant exige
   * MATCH em `documentId` E `workspaceId`. Defesa em profundidade
   * contra colisão de IDs ou input malicioso que tente apagar dados
   * de outro tenant.
   */
  async deleteByDocumentId(documentId: string, workspaceId: string): Promise<void> {
    if (!documentId || typeof documentId !== "string") {
      throw new Error("deleteByDocumentId: documentId obrigatório");
    }
    if (!workspaceId || typeof workspaceId !== "string") {
      throw new Error(
        "deleteByDocumentId: workspaceId obrigatório (segurança multi-tenant)",
      );
    }
    const c = client();
    const col = collection();
    await c.delete(col, {
      wait: true,
      filter: {
        must: [
          { key: "documentId", match: { value: documentId } },
          { key: "workspaceId", match: { value: workspaceId } },
        ],
      },
    });
  }
}

let singleton: QdrantVectorStore | null = null;

export function getQdrantVectorStore(): VectorStore {
  if (!singleton) singleton = new QdrantVectorStore();
  return singleton;
}
