/**
 * Verificação única de acesso ao caso em rotas `/api/cases/[id]/…`.
 * Garante workspace + existência do caso antes de queries adicionais.
 */

import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export type CaseApiAccess = {
  workspaceId: string;
  user: { id: string; email?: string | null };
  caseId: string;
};

export async function requireCaseApiAccess(caseId: string): Promise<CaseApiAccess> {
  const { workspaceId, user } = await getWorkspaceContext();
  const row = await prisma.case.findFirst({
    where: { id: caseId, workspaceId },
    select: { id: true },
  });
  if (!row) {
    const e = new Error("Caso não encontrado");
    (e as { status?: number }).status = 404;
    throw e;
  }
  return { workspaceId, user, caseId: row.id };
}
