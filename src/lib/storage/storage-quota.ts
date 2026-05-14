import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getEnv } from "@/lib/env";
import {
  storagePlanCodeForWorkspaceLicense,
  storagePlanDisplayName,
  type StoragePlanCode,
} from "@/lib/billing/storage-plans";

/** Documentos que ainda ocupam armazenamento: não removidos (soft delete). Arquivados contam. */
export const ACTIVE_DOCUMENT_STORAGE_FILTER = {
  deletedAt: null,
} as const;

export const STORAGE_QUOTA_EXCEEDED_MESSAGE =
  "Seu workspace atingiu o limite de 2 GB de armazenamento. Exclua documentos ou faça upgrade para continuar enviando arquivos.";

export const FILE_EXCEEDS_PLAN_LIMIT_MESSAGE =
  "Este arquivo excede o limite individual permitido para o seu plano.";

export const STORAGE_NEAR_LIMIT_MESSAGE = "Seu workspace está próximo do limite de armazenamento.";

export const STORAGE_BLOCKED_MESSAGE =
  "Limite de armazenamento atingido. Exclua documentos ou faça upgrade para continuar.";

export const STORAGE_UPGRADE_SOON_MESSAGE = "Planos com mais armazenamento estarão disponíveis em breve.";

export class StorageQuotaExceededError extends Error {
  readonly code = "STORAGE_QUOTA_EXCEEDED" as const;

  constructor(
    readonly usedBytes: bigint,
    readonly quotaBytes: bigint,
    readonly attemptedBytes: bigint,
  ) {
    super(STORAGE_QUOTA_EXCEEDED_MESSAGE);
    this.name = "StorageQuotaExceededError";
  }
}

export class FileExceedsPlanLimitError extends Error {
  readonly code = "FILE_SIZE_EXCEEDS_PLAN_LIMIT" as const;

  constructor(readonly maxFileSizeBytes: number, readonly attemptedBytes: bigint) {
    super(FILE_EXCEEDS_PLAN_LIMIT_MESSAGE);
    this.name = "FileExceedsPlanLimitError";
  }
}

function toBigIntSafe(n: number | bigint): bigint {
  if (typeof n === "bigint") return n;
  if (!Number.isFinite(n) || n < 0) return 0n;
  return BigInt(Math.floor(n));
}

export function getDefaultMaxUploadFileSizeBytes(): number {
  return getEnv().DEFAULT_MAX_UPLOAD_FILE_SIZE_BYTES;
}

export async function sumActiveDocumentBytes(
  workspaceId: string,
  tx: Prisma.TransactionClient = prisma,
): Promise<bigint> {
  const agg = await tx.document.aggregate({
    where: { workspaceId, ...ACTIVE_DOCUMENT_STORAGE_FILTER },
    _sum: { sizeBytes: true },
  });
  return BigInt(agg._sum.sizeBytes ?? 0);
}

export async function getWorkspaceStorageQuota(workspaceId: string): Promise<bigint> {
  const row = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { storageQuotaBytes: true },
  });
  if (!row) {
    throw new Error("Workspace não encontrado");
  }
  return row.storageQuotaBytes;
}

export async function getWorkspaceStorageUsage(workspaceId: string): Promise<bigint> {
  return sumActiveDocumentBytes(workspaceId);
}

export type StorageUsageTone = "ok" | "warn" | "strong" | "full";

export type WorkspaceStorageSummary = {
  usedBytes: bigint;
  quotaBytes: bigint;
  remainingBytes: bigint;
  percentUsed: number;
  maxFileSizeBytes: number;
  planCode: StoragePlanCode;
  planName: string;
  tone: StorageUsageTone;
};

function computePercentUsed(used: bigint, quota: bigint): number {
  if (quota <= 0n) return 0;
  const pct = Number((used * 1000n) / quota) / 10;
  return Math.min(100, Math.round(pct * 10) / 10);
}

function toneForPercent(p: number): StorageUsageTone {
  if (p >= 100) return "full";
  if (p > 90) return "strong";
  if (p >= 70) return "warn";
  return "ok";
}

export async function getWorkspaceStorageSummary(workspaceId: string): Promise<WorkspaceStorageSummary> {
  const row = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { storageQuotaBytes: true, license: true },
  });
  if (!row) {
    throw new Error("Workspace não encontrado");
  }
  const usedBytes = await getWorkspaceStorageUsage(workspaceId);
  const quotaBytes = row.storageQuotaBytes;
  const remainingBytes = quotaBytes > usedBytes ? quotaBytes - usedBytes : 0n;
  const percentUsed = computePercentUsed(usedBytes, quotaBytes);
  const planCode = storagePlanCodeForWorkspaceLicense(row.license);
  const planName = storagePlanDisplayName(planCode);
  return {
    usedBytes,
    quotaBytes,
    remainingBytes,
    percentUsed,
    maxFileSizeBytes: getDefaultMaxUploadFileSizeBytes(),
    planCode,
    planName,
    tone: toneForPercent(percentUsed),
  };
}

export async function canUploadFileToWorkspace(params: {
  workspaceId: string;
  fileSizeBytes: number | bigint;
}): Promise<boolean> {
  const add = toBigIntSafe(params.fileSizeBytes);
  if (add <= 0n) return true;
  if (add > BigInt(getDefaultMaxUploadFileSizeBytes())) {
    return false;
  }
  const [used, quota] = await Promise.all([
    getWorkspaceStorageUsage(params.workspaceId),
    getWorkspaceStorageQuota(params.workspaceId),
  ]);
  return used + add <= quota;
}

/**
 * Bloqueia upload fora da quota ou acima do limite por ficheiro.
 * Usa transação com `FOR UPDATE` no workspace para reduzir corridas entre uploads paralelos.
 */
export async function assertCanUploadFileToWorkspace(params: {
  workspaceId: string;
  fileSizeBytes: number | bigint;
}): Promise<void> {
  const add = toBigIntSafe(params.fileSizeBytes);
  if (add <= 0n) return;

  const maxFile = BigInt(getDefaultMaxUploadFileSizeBytes());
  if (add > maxFile) {
    throw new FileExceedsPlanLimitError(getDefaultMaxUploadFileSizeBytes(), add);
  }

  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw(Prisma.sql`SELECT 1 FROM "Workspace" WHERE "id" = ${params.workspaceId} FOR UPDATE`);

    const row = await tx.workspace.findUnique({
      where: { id: params.workspaceId },
      select: { storageQuotaBytes: true },
    });
    if (!row) {
      throw new Error("Workspace não encontrado");
    }

    const used = await sumActiveDocumentBytes(params.workspaceId, tx);
    if (used + add > row.storageQuotaBytes) {
      throw new StorageQuotaExceededError(used, row.storageQuotaBytes, add);
    }
  });
}

export async function incrementWorkspaceStorageUsage(params: {
  workspaceId: string;
  bytes: number | bigint;
}): Promise<void> {
  const b = toBigIntSafe(params.bytes);
  if (b <= 0n) return;
  await prisma.workspace.update({
    where: { id: params.workspaceId },
    data: { storageUsedBytes: { increment: b } },
  });
}

export async function decrementWorkspaceStorageUsage(params: {
  workspaceId: string;
  bytes: number | bigint;
}): Promise<void> {
  const b = toBigIntSafe(params.bytes);
  if (b <= 0n) return;
  await prisma.workspace.update({
    where: { id: params.workspaceId },
    data: { storageUsedBytes: { decrement: b } },
  });
}

export async function recalculateWorkspaceStorageUsage(workspaceId: string): Promise<bigint> {
  const used = await sumActiveDocumentBytes(workspaceId);
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { storageUsedBytes: used },
  });
  return used;
}

const IEC_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

/** Formatação IEC (1024) para UI — valores em bigint. */
export function formatBytesHumanIec(bytes: bigint): string {
  if (bytes <= 0n) return "0 B";
  let v = bytes;
  let i = 0;
  while (v >= 1024n && i < IEC_UNITS.length - 1) {
    v = v / 1024n;
    i++;
  }
  if (i === 0) return `${v} ${IEC_UNITS[i]}`;
  const n = Number(v);
  const rounded = i >= 3 ? n.toFixed(2) : n < 10 ? n.toFixed(1) : n.toFixed(0);
  return `${rounded} ${IEC_UNITS[i]}`;
}

/** Texto principal: "Você usou 850 MB de 2 GB." */
export function formatWorkspaceStorageUsageLine(summary: WorkspaceStorageSummary): string {
  const usedLabel = formatBytesHumanIec(summary.usedBytes);
  const quotaLabel = formatBytesHumanIec(summary.quotaBytes);
  return `Você usou ${usedLabel} de ${quotaLabel}.`;
}

export function storageUploadErrorResponse(err: unknown): NextResponse | null {
  if (err instanceof StorageQuotaExceededError) {
    return NextResponse.json(
      {
        code: err.code,
        message: err.message,
        usedBytes: Number(err.usedBytes),
        quotaBytes: Number(err.quotaBytes),
        attemptedBytes: Number(err.attemptedBytes),
      },
      { status: 403 },
    );
  }
  if (err instanceof FileExceedsPlanLimitError) {
    return NextResponse.json(
      {
        code: err.code,
        message: err.message,
        maxFileSizeBytes: err.maxFileSizeBytes,
        attemptedBytes: Number(err.attemptedBytes),
      },
      { status: 413 },
    );
  }
  return null;
}
