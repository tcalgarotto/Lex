import type { CorpusProvider } from "@prisma/client";

export type SearchHit = {
  id: string;
  type: string;
  title: string;
  subtitle?: string;
  excerpt?: string;
  href?: string;
  /** URL canônica para a fonte oficial (Planalto, DJE…). */
  sourceUrl?: string;
  identifier?: string;
  articleRef?: string;
  fullPath?: string;
  /** URN-LEX da norma quando aplicável. */
  normUrn?: string;
  provider?: CorpusProvider;
  /** Score do retrieval (0..1) quando aplicável. */
  score?: number;
};

export type SearchResponse = {
  hits: SearchHit[];
  /** True quando havia algum hit em LegalChunk (corpus oficial). */
  hadOfficialCorpus: boolean;
  /**
   * True quando env desliga parte do retrieval (corpus jurídico e/ou vetor workspace).
   * A UI pode exibir aviso alinhado à pesquisa assistida (DeepSeek).
   */
  corpusSearchConfigMuted?: boolean;
};
