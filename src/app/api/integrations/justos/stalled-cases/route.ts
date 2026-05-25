/**
 * GET /api/integrations/justos/stalled-cases
 * Lista casos para cron n8n (sem Postgres direto).
 * Auth: Bearer LEX_N8N_SERVICE_TOKEN
 */

import { NextResponse } from "next/server";
import { isLexN8nServiceAuthorized } from "@/lib/justos/n8n-auth";
import { listStalledCasesForJustos } from "@/lib/justos/n8n-secretary-store";

export async function GET(req: Request) {
  if (!isLexN8nServiceAuthorized(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? "15")));
  const cases = await listStalledCasesForJustos(limit);
  return NextResponse.json({ cases });
}
