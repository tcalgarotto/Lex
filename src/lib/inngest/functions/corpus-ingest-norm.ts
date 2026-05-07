/**
 * Worker: processa UMA norma (download + canonicalização + chunking +
 * embeddings + upsert no Qdrant).
 *
 * Idempotente: re-execuções com o mesmo conteúdo viram no-op (versionamento
 * por contentHash decide).
 */

import { NonRetriableError } from "inngest";
import { CorpusProvider } from "@prisma/client";
import { inngest } from "@/lib/inngest/client";
import { fixtureProvider } from "@/lib/corpus/providers/fixture";
import { lexmlProvider, LexmlError } from "@/lib/corpus/providers/lexml";
import type { CorpusPayload } from "@/lib/corpus/providers/types";
import {
  resolvePendingCitationsTo,
  upsertCorpusPayload,
} from "@/lib/corpus/repository";
import { embedAndUpsertNormVersion } from "@/lib/corpus/embeddings-pipeline";

function pickProvider(p: CorpusProvider) {
  switch (p) {
    case CorpusProvider.LEXML:
      return lexmlProvider();
    case CorpusProvider.FIXTURE:
      return fixtureProvider();
    default:
      throw new NonRetriableError(`Provider não suportado: ${p}`);
  }
}

export const corpusIngestNorm = inngest.createFunction(
  {
    id: "corpus-ingest-norm",
    retries: 5,
    throttle: { limit: 30, period: "1m" }, // protege embeddings provider
    concurrency: { limit: 5 },
  },
  { event: "lex/corpus.ingest-norm" },
  async ({ event, step }) => {
    const { provider, urn } = event.data;
    const client = pickProvider(provider);

    const rawPayload = await step.run("fetch-payload", async () => {
      try {
        return await client.fetch({
          urn,
          kind: "OTHER",
          title: urn,
        });
      } catch (err) {
        if (err instanceof LexmlError && !err.retryable) {
          throw new NonRetriableError(err.message);
        }
        throw err;
      }
    });

    // Inngest serializa Date -> string ao passar pelo step. Reidrata.
    const c = rawPayload.candidate as Record<string, unknown>;
    const rehydrated = {
      ...rawPayload.candidate,
      ...(c["publishedAt"] !== undefined
        ? { publishedAt: new Date(c["publishedAt"] as string | Date) }
        : {}),
      ...(c["effectiveAt"] !== undefined
        ? { effectiveAt: new Date(c["effectiveAt"] as string | Date) }
        : {}),
      ...(c["revokedAt"] !== undefined
        ? { revokedAt: new Date(c["revokedAt"] as string | Date) }
        : {}),
      ...(c["lastModifiedAt"] !== undefined
        ? { lastModifiedAt: new Date(c["lastModifiedAt"] as string | Date) }
        : {}),
    } as CorpusPayload["candidate"];
    const payload: CorpusPayload = { ...rawPayload, candidate: rehydrated };

    const result = await step.run("upsert-canonical", () =>
      upsertCorpusPayload(payload, { provider }),
    );

    await step.run("resolve-citations", () => resolvePendingCitationsTo(urn));

    if (result.versioned) {
      await step.run("embed-and-upsert", () =>
        embedAndUpsertNormVersion({ normVersionId: result.versionId }),
      );
    }

    return { ok: true, urn, ...result };
  },
);
