import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { MembershipRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  assertCanUploadFileToWorkspace,
  canUploadFileToWorkspace,
  FileExceedsPlanLimitError,
  getWorkspaceStorageUsage,
  recalculateWorkspaceStorageUsage,
  StorageQuotaExceededError,
} from "@/lib/storage/storage-quota";

describe("workspace storage quota integration", () => {
  const suffix = randomBytes(4).toString("hex");
  let workspaceId = "";
  let userId = "";

  beforeAll(async () => {
    const ws = await prisma.workspace.create({
      data: {
        name: `IT storage ${suffix}`,
        slug: `it-stor-${suffix}`,
        onboardingCompleted: true,
      },
    });
    workspaceId = ws.id;
    const user = await prisma.user.create({
      data: { email: `it-stor-${suffix}@example.com`, name: "IT Storage" },
    });
    userId = user.id;
    await prisma.membership.create({
      data: { workspaceId, userId, role: MembershipRole.OWNER },
    });
  });

  afterAll(async () => {
    if (!workspaceId) return;
    await prisma.document.deleteMany({ where: { workspaceId } });
    await prisma.membership.deleteMany({ where: { workspaceId } });
    await prisma.workspace.delete({ where: { id: workspaceId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    await prisma.$disconnect();
  });

  it("workspace novo começa com uso zero", async () => {
    const used = await getWorkspaceStorageUsage(workspaceId);
    expect(used).toBe(0n);
  });

  it("documento ativo entra na soma e recalculate alinha storageUsedBytes", async () => {
    await prisma.document.create({
      data: {
        workspaceId,
        originalName: "a.pdf",
        mimeType: "application/pdf",
        sizeBytes: 500,
        storagePath: `${workspaceId}/fake-doc/a.pdf`,
      },
    });
    const used = await getWorkspaceStorageUsage(workspaceId);
    expect(used).toBe(500n);
    await recalculateWorkspaceStorageUsage(workspaceId);
    const ws = await prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      select: { storageUsedBytes: true },
    });
    expect(ws.storageUsedBytes).toBe(500n);
  });

  it("upload dentro da quota passa assert", async () => {
    await expect(
      assertCanUploadFileToWorkspace({ workspaceId, fileSizeBytes: 1024 }),
    ).resolves.toBeUndefined();
  });

  it("upload que excede quota bloqueia com StorageQuotaExceededError", async () => {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { storageQuotaBytes: 800n },
    });
    await expect(
      assertCanUploadFileToWorkspace({ workspaceId, fileSizeBytes: 400 }),
    ).rejects.toBeInstanceOf(StorageQuotaExceededError);
    const ok = await canUploadFileToWorkspace({ workspaceId, fileSizeBytes: 200 });
    expect(ok).toBe(true);
  });

  it("arquivo maior que limite individual bloqueia", async () => {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { storageQuotaBytes: 2147483648n },
    });
    await expect(
      assertCanUploadFileToWorkspace({ workspaceId, fileSizeBytes: 200_000_000 }),
    ).rejects.toBeInstanceOf(FileExceedsPlanLimitError);
  });

  it("exclusão de documento reduz uso após recalculate", async () => {
    await prisma.document.deleteMany({ where: { workspaceId } });
    await recalculateWorkspaceStorageUsage(workspaceId);
    const used = await getWorkspaceStorageUsage(workspaceId);
    expect(used).toBe(0n);
  });
});
