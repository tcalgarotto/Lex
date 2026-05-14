/**
 * Backfill de `Workspace.storageUsedBytes` (soma de documentos ativos).
 *
 * Uso:
 *   npm run storage:usage:dry-run
 *   npm run storage:usage:backfill
 */
import { prisma } from "@/lib/prisma";
import { ACTIVE_DOCUMENT_STORAGE_FILTER } from "@/lib/storage/storage-quota";
import { getEnv } from "@/lib/env";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const defaultQuota = BigInt(getEnv().DEFAULT_WORKSPACE_STORAGE_QUOTA_BYTES);
  const rows = await prisma.workspace.findMany({
    select: { id: true, name: true, slug: true, storageQuotaBytes: true, storageUsedBytes: true },
  });

  let updated = 0;
  for (const ws of rows) {
    const agg = await prisma.document.aggregate({
      where: { workspaceId: ws.id, ...ACTIVE_DOCUMENT_STORAGE_FILTER },
      _sum: { sizeBytes: true },
    });
    const sum = BigInt(agg._sum.sizeBytes ?? 0);
    const nextQuota = ws.storageQuotaBytes > 0n ? ws.storageQuotaBytes : defaultQuota;

    const changes: string[] = [];
    if (ws.storageUsedBytes !== sum) {
      changes.push(`storageUsedBytes ${ws.storageUsedBytes} → ${sum}`);
    }
    if (ws.storageQuotaBytes <= 0n) {
      changes.push(`storageQuotaBytes → ${nextQuota}`);
    }

    if (changes.length === 0) continue;

    console.log(`[${ws.slug}] ${ws.name}: ${changes.join("; ")}`);
    if (!dryRun) {
      await prisma.workspace.update({
        where: { id: ws.id },
        data: {
          storageUsedBytes: sum,
          ...(ws.storageQuotaBytes <= 0n ? { storageQuotaBytes: defaultQuota } : {}),
        },
      });
    }
    updated++;
  }

  console.log(
    dryRun
      ? `Dry-run: ${updated} workspace(s) precisariam de atualização.`
      : `Concluído: ${updated} workspace(s) atualizados.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
