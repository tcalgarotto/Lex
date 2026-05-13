import { prisma } from "@/lib/prisma";

export type ProcessHealthStatus = "ok" | "attention" | "stale" | "sync_error";

export type ProcessHealth = {
  status: ProcessHealthStatus;
  score: number;
  reasons: string[];
  lastMovementAt: Date | null;
  lastSyncAt: Date | null;
  openAlerts: number;
};

export async function computeProcessHealth(args: {
  workspaceId: string;
  legalProcessId: string;
}): Promise<ProcessHealth> {
  const [process, lastMovement, openAlerts, lastError] = await Promise.all([
    prisma.legalProcess.findFirst({
      where: { id: args.legalProcessId, workspaceId: args.workspaceId },
      select: { id: true, lastDataJudSyncAt: true, dataJudStatus: true },
    }),
    prisma.legalProcessMovement.findFirst({
      where: { legalProcessId: args.legalProcessId, workspaceId: args.workspaceId },
      orderBy: { dataHora: "desc" },
      select: { dataHora: true },
    }),
    prisma.legalProcessAlert.count({
      where: { legalProcessId: args.legalProcessId, workspaceId: args.workspaceId, status: "OPEN" },
    }),
    prisma.legalProcessSyncLog.findFirst({
      where: { legalProcessId: args.legalProcessId, workspaceId: args.workspaceId, status: "ERROR" },
      orderBy: { startedAt: "desc" },
      select: { startedAt: true, errorMessage: true },
    }),
  ]);
  if (!process) throw new Error("Processo DataJud não encontrado.");

  const reasons: string[] = [];
  let score = 100;
  const now = Date.now();
  const lastSyncAt = process.lastDataJudSyncAt;
  const lastMovementAt = lastMovement?.dataHora ?? null;

  if (!lastSyncAt) {
    score -= 25;
    reasons.push("Processo ainda não sincronizado.");
  } else if (now - lastSyncAt.getTime() > 36 * 60 * 60 * 1000) {
    score -= 20;
    reasons.push("Sincronização DataJud está atrasada.");
  }

  if (lastMovementAt && now - lastMovementAt.getTime() > 180 * 24 * 60 * 60 * 1000) {
    score -= 15;
    reasons.push("Processo sem movimentação recente no DataJud.");
  }

  if (openAlerts > 0) {
    score -= Math.min(30, openAlerts * 5);
    reasons.push(`${openAlerts} alerta(s) aberto(s).`);
  }

  if (lastError) {
    score -= 30;
    reasons.push("Últimas sincronizações registraram erro.");
  }

  const bounded = Math.max(0, Math.min(100, score));
  const status: ProcessHealthStatus =
    lastError ? "sync_error" : bounded < 55 ? "stale" : bounded < 80 ? "attention" : "ok";

  return {
    status,
    score: bounded,
    reasons: reasons.length > 0 ? reasons : ["Sem sinais críticos no DataJud."],
    lastMovementAt,
    lastSyncAt,
    openAlerts,
  };
}
