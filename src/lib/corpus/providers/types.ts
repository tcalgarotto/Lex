/**
 * Interface comum dos provedores de corpus jurídico (LexML, STJ, STF, DataJud).
 *
 * Princípio: provedores são "stateless" (não escrevem em DB). Eles apenas
 * descobrem candidatos e baixam payloads. A persistência canônica é feita
 * pelo `repository.ts` consumindo o que vem do provider.
 */

import type { CorpusProvider, NormKind } from "@prisma/client";

/** Documento canônico vindo de uma fonte (já mapeado pra nosso modelo). */
export type CorpusCandidate = {
  /** URN-LEX canônica (sempre construída pelo provider). */
  urn: string;
  kind: NormKind;
  title: string;
  identifier?: string;
  authority?: string;
  tribunal?: string;
  rapporteur?: string;
  ementa?: string;
  publishedAt?: Date;
  effectiveAt?: Date;
  revokedAt?: Date;
  language?: string;
  tags?: string[];
  sourceUrl?: string;
  sourceExternalId?: string;
  /** ETag/Last-Modified pra HTTP conditional GET na próxima sync. */
  etag?: string;
  lastModifiedAt?: Date;
};

/** Payload completo do documento (texto + html opcional). */
export type CorpusPayload = {
  candidate: CorpusCandidate;
  rawText: string;
  htmlSource?: string;
  metadata?: Record<string, unknown>;
};

/** Resultado de uma página de listagem. */
export type ListPage = {
  candidates: CorpusCandidate[];
  /** Cursor opaco pra próxima página. `null` = fim. */
  nextCursor: string | null;
  /** Total estimado, quando disponível. */
  totalEstimated?: number;
};

/** Filtros de listagem. */
export type ListFilters = {
  kind?: NormKind;
  /** Cursor da última sync (data ISO, oai resumption token, etc). */
  cursor?: string | null;
  /** Limite por página (provider pode capar). */
  pageSize?: number;
};

/** Contrato comum dos providers. */
export interface CorpusProviderClient {
  readonly id: CorpusProvider;
  /** Identifica candidatos novos/atualizados de forma incremental. */
  list(filters: ListFilters): Promise<ListPage>;
  /** Faz fetch do payload completo de UM candidato. Pode lançar. */
  fetch(candidate: CorpusCandidate): Promise<CorpusPayload>;
}
