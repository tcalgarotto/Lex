import { DocumentStatus } from "@prisma/client";

/**
 * Status derivado do documento para exibição no produto, em português.
 *
 * Mapeia cada `DocumentStatus` técnico para um label amigável e calcula
 * em runtime se o documento está "Travado" (`PARSING`/`CHUNKING` há > 15min
 * ou `EMBEDDING` há > 20min sem update). Não altera dado no banco.
 */

export type DocumentDisplayKind = "ok" | "progress" | "warning" | "error";

export interface DocumentDisplayStatus {
  /** Label PT-BR exibido no produto. */
  label: string;
  /** Categoria visual (chip). */
  kind: DocumentDisplayKind;
  /** Status técnico original (referência). */
  raw: DocumentStatus;
  /**
   * Verdadeiro quando o documento ficou parado em um estágio intermediário
   * por mais tempo que o esperado. Não é uma persistência — é um cálculo.
   */
  stalled: boolean;
  /** Há quantos ms está nesse estado (segundo `updatedAt`). */
  staleMs: number;
}

/** Tempo (ms) acima do qual cada estágio intermediário é "Travado". */
export const STALLED_THRESHOLDS_MS: Record<DocumentStatus, number | null> = {
  UPLOADED: null,
  PARSING: 15 * 60_000,
  CHUNKING: 15 * 60_000,
  EMBEDDING: 20 * 60_000,
  INDEXED: null,
  FAILED: null,
};

const LABELS: Record<DocumentStatus, string> = {
  UPLOADED: "Enviado",
  PARSING: "Extraindo texto",
  CHUNKING: "Quebrando em trechos",
  EMBEDDING: "Gerando vetores",
  INDEXED: "Pronto para busca",
  FAILED: "Falhou",
};

const KINDS: Record<DocumentStatus, DocumentDisplayKind> = {
  UPLOADED: "progress",
  PARSING: "progress",
  CHUNKING: "progress",
  EMBEDDING: "progress",
  INDEXED: "ok",
  FAILED: "error",
};

interface StatusInput {
  status: DocumentStatus;
  updatedAt: Date | string | number;
  /** Permite forçar o "agora" em testes. Default: `Date.now()`. */
  now?: Date | number;
}

export function deriveDocumentDisplayStatus(input: StatusInput): DocumentDisplayStatus {
  const now = input.now instanceof Date ? input.now.getTime() : input.now ?? Date.now();
  const updated =
    input.updatedAt instanceof Date
      ? input.updatedAt.getTime()
      : typeof input.updatedAt === "string"
        ? Date.parse(input.updatedAt)
        : input.updatedAt;
  const staleMs = Math.max(0, now - updated);
  const threshold = STALLED_THRESHOLDS_MS[input.status];
  const stalled = threshold !== null && staleMs > threshold;

  if (stalled) {
    return {
      label: "Travado",
      kind: "warning",
      raw: input.status,
      stalled: true,
      staleMs,
    };
  }

  return {
    label: LABELS[input.status],
    kind: KINDS[input.status],
    raw: input.status,
    stalled: false,
    staleMs,
  };
}

/**
 * Status canônicos considerados "em andamento" no pipeline. Útil para
 * filtros de UI e queries.
 */
export const IN_PROGRESS_STATUSES: DocumentStatus[] = [
  DocumentStatus.UPLOADED,
  DocumentStatus.PARSING,
  DocumentStatus.CHUNKING,
  DocumentStatus.EMBEDDING,
];
