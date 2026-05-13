import { LegalProcessSyncStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ProcessAnalytics = {
  total: number;
  openAlerts: number;
  recentMovements: number;
  syncErrors: number;
  latestSync: {
    startedAt: Date;
    status: string;
    tribunalAlias: string;
  } | null;
  byTribunal: Array<{ tribunal: string; count: number }>;
  byStatus: Array<{ status: string; count: number }>;
};

const EMPTY_PROCESS_ANALYTICS: ProcessAnalytics = {
  total: 0,
  openAlerts: 0,
  recentMovements: 0,
  syncErrors: 0,
  latestSync: null,
  byTribunal: [],
  byStatus: [],
};

function isMissingLegalProcessTableError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2021"
  );
}

export async function getProcessAnalytics(workspaceId: string) {
  let total = 0;
  let byTribunal: Array<{ tribunalAcronym: string; _count: { _all: number } }> = [];
  let byStatus: Array<{ dataJudStatus: string; _count: { _all: number } }> = [];
  let openAlerts = 0;
  let recentMovements = 0;
  let syncErrors = 0;
  let latestSync: ProcessAnalytics["latestSync"] = null;

  try {
    [total, byTribunal, byStatus, openAlerts, recentMovements, syncErrors, latestSync] =
      await Promise.all([
        prisma.legalProcess.count({ where: { workspaceId } }),
        prisma.legalProcess.groupBy({
          by: ["tribunalAcronym"],
          where: { workspaceId },
          _count: { _all: true },
          orderBy: { _count: { tribunalAcronym: "desc" } },
          take: 12,
        }),
        prisma.legalProcess.groupBy({
          by: ["dataJudStatus"],
          where: { workspaceId },
          _count: { _all: true },
        }),
        prisma.legalProcessAlert.count({ where: { workspaceId, status: "OPEN" } }),
        prisma.legalProcessMovement.count({
          where: {
            workspaceId,
            createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        }),
        prisma.legalProcessSyncLog.count({
          where: {
            workspaceId,
            status: LegalProcessSyncStatus.ERROR,
            startedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        }),
        prisma.legalProcessSyncLog.findFirst({
          where: { workspaceId },
          orderBy: { startedAt: "desc" },
          select: { startedAt: true, status: true, tribunalAlias: true },
        }),
      ]);
  } catch (error) {
    if (isMissingLegalProcessTableError(error)) return EMPTY_PROCESS_ANALYTICS;
    throw error;
  }

  return {
    total,
    openAlerts,
    recentMovements,
    syncErrors,
    latestSync,
    byTribunal: byTribunal.map((row) => ({
      tribunal: row.tribunalAcronym,
      count: row._count._all,
    })),
    byStatus: byStatus.map((row) => ({
      status: row.dataJudStatus,
      count: row._count._all,
    })),
  };
}
