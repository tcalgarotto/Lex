/**
 * POST /api/cases/[id]/draft
 *
 * Roda retrieval + reasoning + drafting determinístico e persiste a
 * minuta como nova versão (`CaseDraft`). Retorna a versão completa.
 *
 * Auth: requer sessão + workspace ativo.
 */

import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/session";
import { draftWorkflow } from "@/lib/cases/orchestrator";


export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { workspaceId, user } = await getWorkspaceContext();
  const { id } = await params;
  try {
    const out = await draftWorkflow({ workspaceId, userId: user.id, caseId: id });
    return NextResponse.json(out, { status: 201 });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status },
    );
  }
}
