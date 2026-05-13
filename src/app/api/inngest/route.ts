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

import { NextResponse } from "next/server";
import { serve } from "inngest/next";
import { inngest, inngestSecuritySnapshot } from "@/lib/inngest/client";
import { ingestDocument } from "@/lib/inngest/functions/ingest-document";
import { recomputeStyle } from "@/lib/inngest/functions/update-style";
import { summarizeProcessMemory } from "@/lib/inngest/functions/update-memory";
import { corpusSync } from "@/lib/inngest/functions/corpus-sync";
import { corpusIngestNorm } from "@/lib/inngest/functions/corpus-ingest-norm";
import { ingestConstitution } from "@/lib/inngest/functions/ingest-constitution";
import { consolidateCaseBrainFn } from "@/lib/inngest/functions/consolidate-case-brain";
import { checkDocumentConsistencyFn } from "@/lib/inngest/functions/check-document-consistency";
import { generateDocumentThumbnailFn } from "@/lib/inngest/functions/generate-document-thumbnail";
import { dataJudProcessDailySync } from "@/lib/inngest/functions/datajud-process-sync";
import { getLogger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const log = getLogger("inngest.route");

const handlers = serve({
  client: inngest,
  functions: [
    ingestDocument,
    recomputeStyle,
    summarizeProcessMemory,
    corpusSync,
    corpusIngestNorm,
    ingestConstitution,
    consolidateCaseBrainFn,
    checkDocumentConsistencyFn,
    generateDocumentThumbnailFn,
    dataJudProcessDailySync,
  ],
});

/**
 * Gate de segurança: em produção, a rota só aceita requisições se as
 * chaves do Inngest estiverem configuradas. Sem isso, o SDK cai em
 * modo "dev" silenciosamente e qualquer requisição com payload
 * arbitrário pode disparar nossas funções.
 *
 * Quando inseguro, devolvemos 503 explícito em vez de aceitar.
 */
function ensureSecureOr503(): Response | null {
  const sec = inngestSecuritySnapshot();
  if (sec.isSecure) return null;
  log.errorOnce(
    "missing-inngest-keys",
    "REJEITANDO requisições /api/inngest — chaves ausentes em produção",
    { appId: sec.appId, hasEventKey: sec.hasEventKey, hasSigningKey: sec.hasSigningKey },
  );
  return NextResponse.json(
    {
      error: "Inngest misconfigured",
      detail: sec.error,
    },
    { status: 503 },
  );
}

export async function GET(req: Request, ctx?: unknown) {
  const blocked = ensureSecureOr503();
  if (blocked) return blocked;
  return handlers.GET(req as never, ctx as never);
}

export async function POST(req: Request, ctx?: unknown) {
  const blocked = ensureSecureOr503();
  if (blocked) return blocked;
  return handlers.POST(req as never, ctx as never);
}

export async function PUT(req: Request, ctx?: unknown) {
  const blocked = ensureSecureOr503();
  if (blocked) return blocked;
  return handlers.PUT(req as never, ctx as never);
}
