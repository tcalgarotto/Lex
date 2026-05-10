/**
 * POST /api/cases/[id]/brain
 *
 * Recomputa o Case Brain (idempotente via cache por hash). Use quando
 * o usuário quer forçar reconsolidação após editar dados.
 *
 * Pipeline: ver `src/lib/cases/brain.ts` — pré-extract + LLM + validador.
 */

import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/session";
import { reconcileCaseBrainFromWorkspaceCase } from "@/lib/cases/reconcile-case-brain";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { workspaceId, user } = await getWorkspaceContext();
  const { id } = await params;

  try {
    const { brain, cached, llmUsed, degraded, warnings } = await reconcileCaseBrainFromWorkspaceCase({
      workspaceId,
      caseId: id,
      userId: user.id,
    });

    return NextResponse.json(
      {
        brain,
        cached,
        llmUsed,
        degraded,
        warnings,
      },
      { status: 201 },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "Caso não encontrado") {
      return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
    }
    throw e;
  }
}
