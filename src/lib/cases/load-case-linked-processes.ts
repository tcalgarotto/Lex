import { prisma } from "@/lib/prisma";
import type { CaseLinkedProcess } from "@/components/cases/case-process-tab";

/** Processos judiciais vinculados ao caso (workspace-scoped). */
export async function loadCaseLinkedProcesses(
  workspaceId: string,
  caseId: string,
): Promise<CaseLinkedProcess[]> {
  const rows = await prisma.legalProcess.findMany({
    where: { workspaceId, caseId },
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: {
      id: true,
      processId: true,
      cnjFormatted: true,
      tribunalAcronym: true,
      classeNome: true,
      dataJudStatus: true,
      _count: { select: { movements: true, alerts: true } },
    },
  });

  return rows.map((p) => ({
    id: p.id,
    processId: p.processId,
    cnjFormatted: p.cnjFormatted,
    tribunalAcronym: p.tribunalAcronym,
    classeNome: p.classeNome,
    dataJudStatus: p.dataJudStatus,
    movementCount: p._count.movements,
    alertCount: p._count.alerts,
  }));
}
