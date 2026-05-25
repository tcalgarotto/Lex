/**
 * Contexto para rotas `/api/cases/[id]/*`: sessão do usuário ou token n8n.
 */

import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/session";
import { isLexN8nServiceAuthorized } from "@/lib/justos/n8n-auth";
import { isJustosAutomationAllowed } from "@/lib/justos/contact-access";
import { prisma } from "@/lib/prisma";

export type CaseRouteContext = {
  workspaceId: string;
  userId: string;
  via: "session" | "n8n";
};

export class CaseRouteAuthError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function getCaseRouteContext(
  req: Request,
  caseId: string,
): Promise<CaseRouteContext> {
  if (isLexN8nServiceAuthorized(req)) {
    const row = await prisma.case.findFirst({
      where: { id: caseId, deletedAt: null },
      select: {
        workspaceId: true,
        createdById: true,
        workspace: { select: { onboardingJson: true } },
      },
    });
    if (!row) {
      throw new CaseRouteAuthError(404, "Caso não encontrado");
    }
    if (!isJustosAutomationAllowed(row.workspace.onboardingJson)) {
      throw new CaseRouteAuthError(403, "JustOS desativado neste escritório");
    }
    const actor =
      process.env["LEX_N8N_ACTOR_USER_ID"]?.trim() || row.createdById || undefined;
    if (!actor) {
      throw new CaseRouteAuthError(403, "Automação sem ator (LEX_N8N_ACTOR_USER_ID ou createdById)");
    }
    return { workspaceId: row.workspaceId, userId: actor, via: "n8n" };
  }

  const { workspaceId, user } = await getWorkspaceContext();
  const row = await prisma.case.findFirst({
    where: { id: caseId, workspaceId, deletedAt: null },
    select: { id: true },
  });
  if (!row) {
    throw new CaseRouteAuthError(404, "Caso não encontrado");
  }
  return { workspaceId, userId: user.id, via: "session" };
}

export function caseRouteAuthResponse(e: unknown): NextResponse | null {
  if (e instanceof CaseRouteAuthError) {
    return NextResponse.json({ error: e.message }, { status: e.status });
  }
  if (e instanceof Error && e.message === "Não autenticado") {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  return null;
}
