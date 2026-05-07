import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { ingestDocument } from "@/lib/inngest/functions/ingest-document";
import { recomputeStyle } from "@/lib/inngest/functions/update-style";
import { summarizeProcessMemory } from "@/lib/inngest/functions/update-memory";
import { reindexCorpus } from "@/lib/inngest/functions/reindex-corpus";
import { corpusSync } from "@/lib/inngest/functions/corpus-sync";
import { corpusIngestNorm } from "@/lib/inngest/functions/corpus-ingest-norm";

export const maxDuration = 300;

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    ingestDocument,
    recomputeStyle,
    summarizeProcessMemory,
    reindexCorpus,
    corpusSync,
    corpusIngestNorm,
  ],
});
