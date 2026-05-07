import type { VectorSearchHit, VectorStore } from "@/lib/retrieval/vector-store/types";
import type { LegalLayer } from "@prisma/client";

/**
 * Fallback no-op / stub quando pgvector não está no schema.
 * Mantém a interface para testes locais sem Qdrant (retorna vazio).
 */
export class PgVectorStoreStub implements VectorStore {
  async upsertPoints(): Promise<void> {}

  async search(_params: {
    vector: number[];
    workspaceIds: string[];
    layers?: LegalLayer[];
    limit: number;
  }): Promise<VectorSearchHit[]> {
    return [];
  }

  async deleteByDocumentId(): Promise<void> {}
}
