/**
 * POST /api/integrations/sync — dispara sync de todas integrações do workspace.
 *
 * Auth: requer sessão + workspace ativo.
 * Idempotente: alertas duplicados são absorvidos pelo fingerprint.
 */

import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/session";
import { syncWorkspace } from "@/lib/integrations/sync";


export async function POST() {
  const { workspaceId } = await getWorkspaceContext();
  const result = await syncWorkspace({ workspaceId });
  return NextResponse.json(result);
}
