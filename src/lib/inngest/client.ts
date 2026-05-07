import { Inngest } from "inngest";
import type { CorpusProvider, NormKind } from "@prisma/client";

/**
 * App ID do Inngest. É a chave que aparece na console (`Apps → <id>`).
 *
 * Política:
 *   - usa `INNGEST_APP_ID` quando definido (recomendado em produção e preview;
 *     vide `.env.production.example` / `.env.preview.example`);
 *   - fallback estável `lex-production` para evitar que builds sem env caiam
 *     em IDs aleatórios e quebrem o registro de funções no Inngest Cloud.
 *
 * Em preview defina `INNGEST_APP_ID=lex-preview` (app dedicado), em produção
 * `INNGEST_APP_ID=lex-production`. Manter o ID estável é o que permite
 * Inngest Cloud encontrar e atualizar as funções a cada deploy.
 */
export const INNGEST_APP_ID =
  (process.env["INNGEST_APP_ID"] ?? "").trim() || "lex-production";

export const inngest = new Inngest({ id: INNGEST_APP_ID, name: "Lex" });

export type IngestDocumentEvent = {
  name: "lex/document.ingest";
  data: { documentId: string };
};

export type RecomputeStyleEvent = {
  name: "lex/style.recompute";
  data: { workspaceId: string; userId: string | null };
};

export type SummarizeMemoryEvent = {
  name: "lex/memory.summarize";
  data: { workspaceId: string; processId: string; threadId: string };
};

/** Dispara fan-out de sincronização de um provider+kind. */
export type CorpusSyncEvent = {
  name: "lex/corpus.sync";
  data: {
    provider: CorpusProvider;
    kind?: NormKind;
    /** Número máximo de páginas a percorrer nessa execução (default 5). */
    maxPages?: number;
    /** Tamanho da página (default 50). */
    pageSize?: number;
  };
};

/** Worker que processa UMA norma (URN). */
export type CorpusIngestNormEvent = {
  name: "lex/corpus.ingest-norm";
  data: {
    provider: CorpusProvider;
    urn: string;
  };
};
