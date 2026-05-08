/**
 * Worker Inngest: ingere a Constituição Federal de 1988 a partir do
 * markdown curado em `codigos de leis/CONSTITUICAO.md`.
 *
 * Steps:
 *  1. read-markdown      — lê arquivo do disco.
 *  2. parse-markdown     — `parseConstitutionMarkdown`.
 *  3. build-payload      — monta `CorpusPayload` (kind=CONSTITUTION,
 *                          provider=MANUAL, URN canônica).
 *  4. upsert-canonical   — `upsertCorpusPayload` (Postgres canonical).
 *  5. resolve-citations  — resolve citações pendentes que apontavam pra CF.
 *  6. embed-and-upsert   — `embedAndUpsertNormVersion` quando há nova versão.
 *
 * Idempotente: re-execuções com markdown idêntico viram no-op.
 *
 * Concorrência: limite 1 (só uma ingestão da CF por vez — payload é grande).
 */

import { NonRetriableError } from "inngest";
import { CorpusProvider } from "@prisma/client";
import { inngest } from "@/lib/inngest/client";
import {
  buildCfCorpusPayload,
  loadParsedConstitution,
} from "@/lib/corpus/providers/markdown-cf";
import {
  resolvePendingCitationsTo,
  upsertCorpusPayload,
} from "@/lib/corpus/repository";
import { embedAndUpsertNormVersion } from "@/lib/corpus/embeddings-pipeline";
import { CF_URN } from "@/lib/corpus/providers/markdown-cf";

export const ingestConstitution = inngest.createFunction(
  {
    id: "ingest-constitution",
    retries: 3,
    concurrency: { limit: 1 },
  },
  { event: "lex/corpus.ingest-cf" },
  async ({ event, step }) => {
    const markdownPath = (event.data?.markdownPath as string | undefined) ?? undefined;
    const skipEmbed = Boolean(event.data?.skipEmbed);

    const { mdLength, parseStats } = await step.run("read-and-parse", async () => {
      try {
        const { md, parsed } = await loadParsedConstitution(markdownPath);
        return {
          mdLength: md.length,
          parseStats: parsed.cfStats,
        };
      } catch (err) {
        // Arquivo ausente ou markdown malformado é não-recuperável.
        throw new NonRetriableError((err as Error).message);
      }
    });

    // Reparseia dentro do step de upsert pra evitar passar payload gigante
    // pelo serializer do Inngest (>1MB causa erro de step output size).
    const result = await step.run("upsert-canonical", async () => {
      const { md, parsed } = await loadParsedConstitution(markdownPath);
      const payload = buildCfCorpusPayload(parsed, md);
      return upsertCorpusPayload(payload, { provider: CorpusProvider.MANUAL });
    });

    await step.run("resolve-citations", () => resolvePendingCitationsTo(CF_URN));

    let embedSummary: { processed: number; skipped: number; errors: number } | null = null;
    if (!skipEmbed && result.versioned) {
      const r = await step.run("embed-and-upsert", () =>
        embedAndUpsertNormVersion({ normVersionId: result.versionId }),
      );
      embedSummary = {
        processed: r.chunksProcessed,
        skipped: r.chunksSkipped,
        errors: r.errors,
      };
    }

    return {
      ok: true,
      urn: CF_URN,
      mdLength,
      parseStats,
      ingest: {
        normId: result.normId,
        versionId: result.versionId,
        created: result.created,
        versioned: result.versioned,
        chunks: result.chunksUpserted,
        citations: result.citationsUpserted,
        contentHash: result.contentHash,
      },
      embed: embedSummary,
    };
  },
);
