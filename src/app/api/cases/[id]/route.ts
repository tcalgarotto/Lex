/**
 * GET /api/cases/[id] — devolve caso completo com todas as relações.
 *
 * Auth: requer sessão + workspace ativo.
 */

import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/session";
import { getCaseById } from "@/lib/cases/repository";


export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { workspaceId } = await getWorkspaceContext();
  const { id } = await params;
  const c = await getCaseById(workspaceId, id);
  if (!c) {
    return NextResponse.json({ error: "Caso não encontrado." }, { status: 404 });
  }
  return NextResponse.json({ case: c });
}
