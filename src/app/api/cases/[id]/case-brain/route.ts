/**
 * GET /api/cases/[id]/case-brain — snapshot público para n8n / JustOS Command.
 * Auth: sessão ou Bearer `LEX_N8N_SERVICE_TOKEN`.
 */

import { NextResponse } from "next/server";
import { getCaseBrainSnapshot } from "@/lib/cases/case-brain/snapshot";
import { getCaseRouteContext, caseRouteAuthResponse } from "@/lib/auth/case-route-context";


export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: caseId } = await params;
  try {
    const { workspaceId } = await getCaseRouteContext(req, caseId);
    const snap = await getCaseBrainSnapshot(caseId, workspaceId);
    if (!snap) {
      return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
    }
    return NextResponse.json(snap);
  } catch (e) {
    const authRes = caseRouteAuthResponse(e);
    if (authRes) return authRes;
    throw e;
  }
}
