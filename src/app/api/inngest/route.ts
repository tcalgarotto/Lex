/**
 * Endpoint de serve do Inngest.
 *
 * Inngest Cloud bate aqui em duas situações:
 *  - **Sync** (registro de funções): chamada GET/PUT, descobre a lista
 *    de funções e respectivos triggers/IDs.
 *  - **Run**: chamada POST com payload assinado pelo signing key, para
 *    executar uma step.
 *
 * Cuidados em produção:
 *  - `runtime = "nodejs"` é obrigatório (Inngest precisa de Node API).
 *  - `maxDuration = 300` permite que steps mais longas (ex.: corpus
 *    ingest) terminem antes do timeout. Em Vercel Hobby o valor é
 *    silenciosamente capado para o limite do plano (60s); em Pro respeita
 *    os 300s.
 *  - Não setar `dynamic = "force-static"` — toda requisição é dinâmica.
 *  - Vercel Deployment Protection (Vercel Authentication) DEVE estar
 *    desligada nesta rota OU o app deve ter Protection Bypass for
 *    Automation, senão Inngest recebe 401 e mostra "No syncs found".
 *    Veja `docs/INNGEST_PRODUCTION.md` (seção Troubleshooting).
 */

import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { ingestDocument } from "@/lib/inngest/functions/ingest-document";
import { recomputeStyle } from "@/lib/inngest/functions/update-style";
import { summarizeProcessMemory } from "@/lib/inngest/functions/update-memory";
import { reindexCorpus } from "@/lib/inngest/functions/reindex-corpus";
import { corpusSync } from "@/lib/inngest/functions/corpus-sync";
import { corpusIngestNorm } from "@/lib/inngest/functions/corpus-ingest-norm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
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
