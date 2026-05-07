/**
 * Job orquestrador: lista candidatos do provider e dispara workers por URN.
 *
 *  - Avança cursor (watermark) por (provider, kind).
 *  - Limita páginas por execução (maxPages).
 *  - Re-agenda automaticamente se sobrar trabalho.
 */

import { NonRetriableError } from "inngest";
import { CorpusProvider, IngestionJobStatus, NormKind } from "@prisma/client";
import { inngest } from "@/lib/inngest/client";
import { fixtureProvider } from "@/lib/corpus/providers/fixture";
import { lexmlProvider } from "@/lib/corpus/providers/lexml";
import type { CorpusProviderClient } from "@/lib/corpus/providers/types";
import {
  finishIngestionJob,
  readWatermark,
  startIngestionJob,
  writeWatermark,
} from "@/lib/corpus/repository";

function pickProvider(p: CorpusProvider): CorpusProviderClient {
  switch (p) {
    case CorpusProvider.LEXML:
      return lexmlProvider();
    case CorpusProvider.FIXTURE:
      return fixtureProvider();
    default:
      throw new NonRetriableError(`Provider não suportado neste worker: ${p}`);
  }
}

export const corpusSync = inngest.createFunction(
  {
    id: "corpus-sync",
    retries: 3,
    // Throttle pra não martelar LexML.
    throttle: { limit: 4, period: "1m" },
    concurrency: { limit: 2 },
  },
  { event: "lex/corpus.sync" },
  async ({ event, step }) => {
    const { provider, kind } = event.data;
    const maxPages = event.data.maxPages ?? 5;
    const pageSize = event.data.pageSize ?? 50;

    const jobId = await step.run("start-job", () =>
      startIngestionJob({ provider, ...(kind ? { kind } : {}) }),
    );

    let cursor = await step.run("read-watermark", () =>
      readWatermark(provider, kind),
    );

    let pagesProcessed = 0;
    let totalCandidates = 0;
    let totalDispatched = 0;

    try {
      while (pagesProcessed < maxPages) {
        const client = pickProvider(provider);
        const page = await step.run(`list-page-${pagesProcessed}`, () =>
          client.list({
            ...(kind !== undefined ? { kind } : {}),
            cursor,
            pageSize,
          }),
        );

        totalCandidates += page.candidates.length;

        if (page.candidates.length > 0) {
          const events = page.candidates.map((c) => ({
            name: "lex/corpus.ingest-norm" as const,
            data: { provider, urn: c.urn },
          }));
          // sendEvent é idempotente por URN (workers fazem upsert).
          await step.sendEvent(`dispatch-page-${pagesProcessed}`, events);
          totalDispatched += events.length;
        }

        cursor = page.nextCursor;
        pagesProcessed += 1;

        await step.run(`watermark-${pagesProcessed}`, () =>
          writeWatermark({
            provider,
            kind: (kind ?? NormKind.OTHER) as NormKind,
            cursor,
            ...(typeof page.totalEstimated === "number"
              ? { itemsTotal: page.totalEstimated }
              : {}),
          }),
        );

        if (!cursor) break;
      }

      // Se sobrou trabalho, re-agenda continuação.
      if (cursor) {
        await step.sendEvent("reschedule", {
          name: "lex/corpus.sync",
          data: {
            provider,
            ...(kind !== undefined ? { kind } : {}),
            maxPages,
            pageSize,
          },
        });
      }

      await step.run("finish-job", () =>
        finishIngestionJob(jobId, {
          status: cursor ? IngestionJobStatus.PARTIAL : IngestionJobStatus.COMPLETED,
          itemsProcessed: totalCandidates,
        }),
      );

      return {
        ok: true,
        provider,
        kind,
        pagesProcessed,
        totalCandidates,
        totalDispatched,
        nextCursor: cursor,
      };
    } catch (err) {
      await finishIngestionJob(jobId, {
        status: IngestionJobStatus.FAILED,
        errorMessage: (err as Error).message,
      });
      throw err;
    }
  },
);
