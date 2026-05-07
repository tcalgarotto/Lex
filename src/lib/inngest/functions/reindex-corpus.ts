import { NonRetriableError } from "inngest";
import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";
import { indexLegalSourcesToQdrant } from "@/lib/services/corpus-index";

export const reindexCorpus = inngest.createFunction(
  { id: "reindex-corpus", retries: 2 },
  { event: "lex/corpus.reindex" },
  async ({ event, step }) => {
    const sourceIds = event.data.sourceIds as string[] | undefined;

    const count = await step.run("count-sources", () =>
      prisma.legalSource.count({
        where: sourceIds?.length ? { id: { in: sourceIds } } : undefined,
      }),
    );

    if (count === 0) throw new NonRetriableError("Nenhuma fonte para indexar");

    const indexed = await step.run("index", () => indexLegalSourcesToQdrant(sourceIds));

    return { ok: true, count: indexed };
  },
);
