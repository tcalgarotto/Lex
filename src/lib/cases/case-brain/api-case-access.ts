/**
 * P0 — Case Brain pipeline (entrevista → dados → persistência).
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/CASE_BRAIN.md
 */

import { prisma } from "@/lib/prisma";

export async function findCaseInWorkspace(workspaceId: string, caseId: string) {
  return prisma.case.findFirst({
    where: { id: caseId, workspaceId, deletedAt: null },
    select: { id: true },
  });
}
