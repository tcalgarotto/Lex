/**
 * POST /api/cases/[id]/review
 *
 * Combina contradiction + issue spotting + checklist sobre a última minuta
 * persistida e retorna o `ReviewResult` + score + verdict.
 *
 * Auth: requer sessão + workspace ativo.
 */

import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/session";
import { reviewWorkflow } from "@/lib/cases/orchestrator";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { workspaceId, user } = await getWorkspaceContext();
  const { id } = await params;
  try {
    const out = await reviewWorkflow({ workspaceId, userId: user.id, caseId: id });
    return NextResponse.json(out, { status: 201 });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status },
    );
  }
}
