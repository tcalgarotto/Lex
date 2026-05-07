import { Inngest } from "inngest";
import type { CorpusProvider, NormKind } from "@prisma/client";

export const inngest = new Inngest({ id: "lex", name: "Lex" });

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
