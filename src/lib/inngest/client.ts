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

/**
 * Validação de segurança: em produção, INNGEST_SIGNING_KEY é obrigatório.
 *
 * Sem signing key, qualquer um que descubra a URL do `/api/inngest` pode
 * disparar nossas funções (ingestão, embeddings, sync de corpus). O SDK
 * cai em modo "dev" silenciosamente — exatamente o que a auditoria
 * apontou como risco crítico.
 *
 * Em produção, exigimos as duas chaves (event key + signing key). Em
 * dev/test/preview, apenas avisamos.
 */
export function inngestSecuritySnapshot(): {
  appId: string;
  hasEventKey: boolean;
  hasSigningKey: boolean;
  isProduction: boolean;
  isSecure: boolean;
  error?: string;
} {
  const eventKey = (process.env["INNGEST_EVENT_KEY"] ?? "").trim();
  const signingKey = (process.env["INNGEST_SIGNING_KEY"] ?? "").trim();
  const isProduction = process.env["NODE_ENV"] === "production";
  const hasEventKey = eventKey.length > 0;
  const hasSigningKey = signingKey.length > 0;
  const isSecure = !isProduction || (hasEventKey && hasSigningKey);
  return {
    appId: INNGEST_APP_ID,
    hasEventKey,
    hasSigningKey,
    isProduction,
    isSecure,
    ...(!isSecure
      ? {
          error:
            "INNGEST_SIGNING_KEY/INNGEST_EVENT_KEY ausentes em produção. " +
            "/api/inngest aceitaria requisições não autenticadas. " +
            "Configure as duas chaves em Vercel → Environment Variables (Production) e faça Redeploy.",
        }
      : {}),
  };
}

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
