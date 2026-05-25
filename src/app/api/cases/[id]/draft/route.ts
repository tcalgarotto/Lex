/**
 * POST /api/cases/[id]/draft
 *
 * Roda retrieval + reasoning + drafting determinístico e persiste a
 * minuta como nova versão (`CaseDraft`). Retorna a versão completa.
 *
 * Auth: sessão + workspace ou Bearer `LEX_N8N_SERVICE_TOKEN` (n8n).
 */

import { NextResponse } from "next/server";
import { draftWorkflow } from "@/lib/cases/orchestrator";
import { fireLexJustosEventForCase } from "@/lib/justos";
import { getCaseRouteContext, caseRouteAuthResponse } from "@/lib/auth/case-route-context";


export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { workspaceId, userId } = await getCaseRouteContext(req, id);
    const out = await draftWorkflow({ workspaceId, userId, caseId: id });
    fireLexJustosEventForCase({
      event: "lex.draft.generated",
      workspaceId,
      caseId: id,
      meta: { draftId: out.draft.id, version: out.draft.version, draftVersion: out.draft.version },
    });
    return NextResponse.json(out, { status: 201 });
  } catch (e) {
    const authRes = caseRouteAuthResponse(e);
    if (authRes) return authRes;
    const status = (e as { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status },
    );
  }
}
