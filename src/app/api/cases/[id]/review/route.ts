/**
 * POST /api/cases/[id]/review
 *
 * Combina contradiction + issue spotting + checklist sobre a última minuta.
 * Auth: sessão ou Bearer `LEX_N8N_SERVICE_TOKEN`.
 */

import { NextResponse } from "next/server";
import { reviewWorkflow } from "@/lib/cases/orchestrator";
import { fireLexJustosEventForCase } from "@/lib/justos";
import { getCaseRouteContext, caseRouteAuthResponse } from "@/lib/auth/case-route-context";


export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { workspaceId, userId } = await getCaseRouteContext(req, id);
    const out = await reviewWorkflow({ workspaceId, userId, caseId: id });
    fireLexJustosEventForCase({
      event: "lex.review.completed",
      workspaceId,
      caseId: id,
      meta: {
        verdict: out.review.verdict,
        score: out.review.score,
      },
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
