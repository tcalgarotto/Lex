/**
 * POST /api/cases/[id]/brain
 *
 * Recomputa o Case Brain (idempotente via cache por hash).
 * Auth: sessão ou Bearer `LEX_N8N_SERVICE_TOKEN`.
 */

import { NextResponse } from "next/server";
import { reconcileCaseBrainFromWorkspaceCase } from "@/lib/cases/reconcile-case-brain";
import { fireLexJustosEventForCase } from "@/lib/justos";
import { getCaseRouteContext, caseRouteAuthResponse } from "@/lib/auth/case-route-context";


export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const { workspaceId, userId } = await getCaseRouteContext(req, id);
    const { brain, cached, llmUsed, degraded, warnings } =
      await reconcileCaseBrainFromWorkspaceCase({
        workspaceId,
        caseId: id,
        userId,
      });

    if (!cached) {
      fireLexJustosEventForCase({
        event: "lex.brain.consolidated",
        workspaceId,
        caseId: id,
        meta: {
          brainVersion: brain.brainVersion,
          readinessScore: brain.proceduralReadiness?.score,
          readinessStatus: brain.proceduralReadiness?.status,
        },
      });
    }

    return NextResponse.json(
      { brain, cached, llmUsed, degraded, warnings },
      { status: 201 },
    );
  } catch (e) {
    const authRes = caseRouteAuthResponse(e);
    if (authRes) return authRes;
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Caso não encontrado") {
      return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
    }
    throw e;
  }
}
