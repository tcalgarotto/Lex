import {
  LegalProcessAlertSeverity,
  LegalProcessAlertStatus,
  LegalProcessAlertType,
  LegalProcessSyncSource,
} from "@prisma/client";
import { importProcessByCnj } from "@/lib/legal-processes/import-process-by-cnj";
import { prisma } from "@/lib/prisma";

export type SyncProcessMovementsResult = {
  legalProcessId: string;
  processId: string;
  importedMovements: number;
  alertsCreated: number;
};

export async function syncProcessMovements(args: {
  workspaceId: string;
  legalProcessId: string;
  source?: LegalProcessSyncSource;
}): Promise<SyncProcessMovementsResult> {
  const legalProcess = await prisma.legalProcess.findFirst({
    where: { id: args.legalProcessId, workspaceId: args.workspaceId },
    select: { id: true, cnj: true, processId: true, cnjFormatted: true },
  });
  if (!legalProcess) throw new Error("Processo DataJud não encontrado.");

  const syncStartedAt = new Date();
  const result = await importProcessByCnj({
    workspaceId: args.workspaceId,
    cnj: legalProcess.cnj,
    source: args.source ?? LegalProcessSyncSource.MANUAL,
  });

  const newMovements = await prisma.legalProcessMovement.findMany({
    where: {
      workspaceId: args.workspaceId,
      legalProcessId: args.legalProcessId,
      createdAt: { gte: syncStartedAt },
    },
    orderBy: { dataHora: "desc" },
    select: { id: true, movementHash: true, nome: true, dataHora: true, category: true },
  });

  let alertsCreated = 0;
  for (const movement of newMovements) {
    const created = await prisma.legalProcessAlert.upsert({
      where: {
        workspaceId_fingerprint: {
          workspaceId: args.workspaceId,
          fingerprint: `new-movement:${args.legalProcessId}:${movement.movementHash}`,
        },
      },
      update: {},
      create: {
        workspaceId: args.workspaceId,
        legalProcessId: args.legalProcessId,
        type: LegalProcessAlertType.NEW_MOVEMENT,
        severity:
          movement.category === "decisao" || movement.category === "comunicacao"
            ? LegalProcessAlertSeverity.MEDIUM
            : LegalProcessAlertSeverity.INFO,
        title: "Nova movimentação DataJud",
        description: movement.nome,
        status: LegalProcessAlertStatus.OPEN,
        fingerprint: `new-movement:${args.legalProcessId}:${movement.movementHash}`,
        payloadJson: {
          movementId: movement.id,
          category: movement.category,
          dataHora: movement.dataHora?.toISOString() ?? null,
        },
      },
      select: { createdAt: true },
    });
    if (created.createdAt >= syncStartedAt) alertsCreated += 1;
  }

  return {
    legalProcessId: args.legalProcessId,
    processId: result.processId,
    importedMovements: result.importedMovements,
    alertsCreated,
  };
}

export async function syncDueDataJudProcesses(args: {
  workspaceId?: string;
  staleBefore?: Date;
  take?: number;
} = {}) {
  const staleBefore =
    args.staleBefore ?? new Date(Date.now() - 23 * 60 * 60 * 1000);
  const processes = await prisma.legalProcess.findMany({
    where: {
      ...(args.workspaceId ? { workspaceId: args.workspaceId } : {}),
      OR: [{ lastDataJudSyncAt: null }, { lastDataJudSyncAt: { lt: staleBefore } }],
    },
    orderBy: [{ lastDataJudSyncAt: "asc" }, { createdAt: "asc" }],
    take: args.take ?? 50,
    select: { id: true, workspaceId: true },
  });

  const results = [];
  for (const process of processes) {
    try {
      results.push(
        await syncProcessMovements({
          workspaceId: process.workspaceId,
          legalProcessId: process.id,
          source: LegalProcessSyncSource.DAILY,
        }),
      );
    } catch (error) {
      results.push({
        legalProcessId: process.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return results;
}
