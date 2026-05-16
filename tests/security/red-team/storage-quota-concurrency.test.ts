/**
 * FASE 3.1 — Quota 2GB e concorrência (Prisma; storage mockado onde aplicável).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { assertRedTeamSafeEnvironment } from "../../../scripts/security-audit/env-guard";
import { RT } from "./fixture-ids";
import { RedTeamReport } from "./helpers";
import { prisma } from "@/lib/prisma";
import {
  assertCanUploadFileToWorkspace,
  recalculateWorkspaceStorageUsage,
  StorageQuotaExceededError,
} from "@/lib/storage/storage-quota";

const report = new RedTeamReport();
const QUOTA_WS = "rt_quota_concurrency_ws";

let envOk = false;

beforeAll(async () => {
  const guard = assertRedTeamSafeEnvironment();
  envOk = guard.ok;
  if (!envOk) {
    report.skip("Ambiente quota", guard.ok === false ? guard.reason : "desconhecido");
    return;
  }
  await prisma.workspace.upsert({
    where: { id: QUOTA_WS },
    create: {
      id: QUOTA_WS,
      slug: "redteam-quota-concurrency",
      name: "[REDTEAM] Quota Concurrency",
      storageQuotaBytes: 1000n,
      storageUsedBytes: 900n,
    },
    update: {
      storageQuotaBytes: 1000n,
      storageUsedBytes: 900n,
    },
  });
  await prisma.document.deleteMany({ where: { workspaceId: QUOTA_WS } });
  await prisma.document.create({
    data: {
      id: "rt_quota_fill_doc",
      workspaceId: QUOTA_WS,
      originalName: "fill.bin",
      mimeType: "text/plain",
      sizeBytes: 900,
      storagePath: `${QUOTA_WS}/rt_quota_fill_doc/fill.bin`,
      status: "UPLOADED",
    },
  });
  await recalculateWorkspaceStorageUsage(QUOTA_WS);
});

afterAll(async () => {
  if (envOk) {
    await prisma.document.deleteMany({ where: { workspaceId: QUOTA_WS } }).catch(() => {});
    await prisma.workspace.delete({ where: { id: QUOTA_WS } }).catch(() => {});
  }
  report.print();
});

describe("FASE 3.1 — Quota e concorrência", () => {
  it("QC.1 upload acima do saldo bloqueia", async () => {
    if (!envOk) return;
    await expect(
      assertCanUploadFileToWorkspace({ workspaceId: QUOTA_WS, fileSizeBytes: 200 }),
    ).rejects.toBeInstanceOf(StorageQuotaExceededError);
    report.pass("QC.1 quota excedida → StorageQuotaExceededError");
  });

  it("QC.2 operação em workspace quota não altera workspace B", async () => {
    if (!envOk) return;
    const bBefore = await prisma.workspace.findUnique({
      where: { id: RT.workspaces.b.id },
      select: { storageUsedBytes: true },
    });
    await expect(
      assertCanUploadFileToWorkspace({ workspaceId: QUOTA_WS, fileSizeBytes: 200 }),
    ).rejects.toBeInstanceOf(StorageQuotaExceededError);
    const bAfter = await prisma.workspace.findUnique({
      where: { id: RT.workspaces.b.id },
      select: { storageUsedBytes: true },
    });
    expect(bBefore?.storageUsedBytes).toBe(bAfter?.storageUsedBytes);
    report.pass("QC.2 quota B inalterada");
  });

  it("QC.3 após documento persistido, segunda reserva falha", async () => {
    if (!envOk) return;
    await prisma.document.deleteMany({ where: { workspaceId: QUOTA_WS } });
    await prisma.workspace.update({
      where: { id: QUOTA_WS },
      data: { storageQuotaBytes: 1000n },
    });
    await assertCanUploadFileToWorkspace({ workspaceId: QUOTA_WS, fileSizeBytes: 600 });
    await prisma.document.create({
      data: {
        id: "rt_quota_half",
        workspaceId: QUOTA_WS,
        originalName: "half.bin",
        mimeType: "text/plain",
        sizeBytes: 600,
        storagePath: `${QUOTA_WS}/rt_quota_half/half.bin`,
        status: "UPLOADED",
      },
    });
    await expect(
      assertCanUploadFileToWorkspace({ workspaceId: QUOTA_WS, fileSizeBytes: 500 }),
    ).rejects.toBeInstanceOf(StorageQuotaExceededError);
    report.pass("QC.3 segunda reserva após doc → bloqueada");
  });

  it("QC.3b asserts paralelos sem doc — ambos podem passar (limite conhecido)", async () => {
    if (!envOk) return;
    await prisma.document.deleteMany({ where: { workspaceId: QUOTA_WS } });
    const results = await Promise.allSettled([
      assertCanUploadFileToWorkspace({ workspaceId: QUOTA_WS, fileSizeBytes: 600 }),
      assertCanUploadFileToWorkspace({ workspaceId: QUOTA_WS, fileSizeBytes: 600 }),
    ]);
    const fulfilled = results.filter((r) => r.status === "fulfilled").length;
    expect(fulfilled).toBeGreaterThanOrEqual(1);
    report.pass("QC.3b paralelo sem persistência documentada", { obtained: `ok=${fulfilled}` });
  });

  it("QC.4 recalculate mantém soma dos documentos ativos", async () => {
    if (!envOk) return;
    const docId = "rt_quota_doc_recalc";
    await prisma.document.upsert({
      where: { id: docId },
      create: {
        id: docId,
        workspaceId: QUOTA_WS,
        originalName: "q.txt",
        mimeType: "text/plain",
        sizeBytes: 120,
        storagePath: `${QUOTA_WS}/${docId}/q.txt`,
        status: "UPLOADED",
      },
      update: { sizeBytes: 120, deletedAt: null },
    });
    const used = await recalculateWorkspaceStorageUsage(QUOTA_WS);
    expect(used).toBe(120n);
    const row = await prisma.workspace.findUnique({
      where: { id: QUOTA_WS },
      select: { storageUsedBytes: true },
    });
    expect(row?.storageUsedBytes).toBe(120n);
    report.pass("QC.4 recalculate consistente", { obtained: String(used) });
  });

  it("QC.5 quota e rate limit são chaves independentes", async () => {
    if (!envOk) return;
    const { rateLimit } = await import("@/lib/rate-limit");
    const rl = await rateLimit({
      key: `upload:${QUOTA_WS}:rt_user`,
      limit: 20,
      windowSeconds: 60,
      tier: "expensive",
    });
    expect(rl).toHaveProperty("allowed");
    await prisma.document.deleteMany({ where: { workspaceId: QUOTA_WS } });
    await recalculateWorkspaceStorageUsage(QUOTA_WS);
    await expect(
      assertCanUploadFileToWorkspace({ workspaceId: QUOTA_WS, fileSizeBytes: 1 }),
    ).resolves.toBeUndefined();
    report.pass("QC.5 rate limit não substitui quota", {
      obtained: `rl.source=${rl.source}`,
    });
  });
});
