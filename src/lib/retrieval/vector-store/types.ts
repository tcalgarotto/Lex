import type { LegalChunkSection, LegalLayer } from "@prisma/client";

export type VectorPayload = {
  workspaceId: string;
  layer: LegalLayer;
  chunkText: string;
  section?: LegalChunkSection;
  contentHash?: string;
  documentId?: string;
  processId?: string;
  pieceId?: string;
  sourceCode?: string;
  articleRef?: string;
  tribunal?: string;
};

export type VectorSearchHit = {
  id: string;
  score: number;
  payload: VectorPayload;
};

export interface VectorStore {
  upsertPoints(
    points: Array<{
      id: string;
      vector: number[];
      payload: VectorPayload;
    }>,
  ): Promise<void>;
  search(params: {
    vector: number[];
    workspaceIds: string[];
    layers?: LegalLayer[];
    limit: number;
  }): Promise<VectorSearchHit[]>;
  /**
   * Deleta TODOS os vetores de um documento pertencente ao workspace
   * informado. `workspaceId` é OBRIGATÓRIO — sem ele, o filtro não
   * isola tenant e poderia, em teoria, deletar o vetor de outro
   * workspace que tivesse o mesmo `documentId` (defesa em profundidade
   * contra colisão / input malicioso).
   */
  deleteByDocumentId(documentId: string, workspaceId: string): Promise<void>;
}
