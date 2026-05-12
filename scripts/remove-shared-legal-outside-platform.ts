/**
 * Remove `Document` com `SHARED_LEGAL` cujo `originalName` coincide com ficheiros
 * do catálogo global, mas que ainda estão noutro workspace (ex.: upload antigo).
 *
 *   npx tsx --env-file=.env scripts/remove-shared-legal-outside-platform.ts
 *   npx tsx --env-file=.env scripts/remove-shared-legal-outside-platform.ts -- --dry-run
 */

import { DocumentLibraryShelf } from "@prisma/client";

import "../src/lib/env-normalize";
import { getPlatformLibraryWorkspaceId } from "../src/lib/biblioteca/platform-library";
import { prisma } from "../src/lib/prisma";
import { removeDocumentBuffer } from "../src/lib/storage";
import { getQdrantVectorStore } from "../src/lib/retrieval/vector-store/qdrant-store";

const CATALOG_NAMES = ["Lei Maria Penha normas correlatas", "Vade mecum 2026"] as const;

function parseArgs(): { dryRun: boolean } {
  let dryRun = false;
  for (const a of process.argv.slice(2)) {
    if (a === "--dry-run") dryRun = true;
  }
  return { dryRun };
}

async function permanentlyDelete(doc: { id: string; workspaceId: string; storagePath: string }) {
  try {
    await getQdrantVectorStore().deleteByDocumentId(doc.id, doc.workspaceId);
  } catch {
    /* non-fatal */
  }
  try {
    await removeDocumentBuffer(doc.storagePath);
  } catch {
    /* non-fatal */
  }
  await prisma.document.delete({ where: { id: doc.id } });
}

async function main() {
  const { dryRun } = parseArgs();
  const platformId = await getPlatformLibraryWorkspaceId();
  if (!platformId) {
    throw new Error("Workspace de catálogo global não encontrado (slug lex-platform-catalog ou env).");
  }

  const stale = await prisma.document.findMany({
    where: {
      libraryShelf: DocumentLibraryShelf.SHARED_LEGAL,
      originalName: { in: [...CATALOG_NAMES] },
      deletedAt: null,
      NOT: { workspaceId: platformId },
    },
    select: { id: true, workspaceId: true, storagePath: true, originalName: true },
  });

  if (stale.length === 0) {
    console.log(JSON.stringify({ ok: true, message: "Nenhuma cópia fora do catálogo global.", platformId }, null, 2));
    return;
  }

  for (const d of stale) {
    if (dryRun) {
      console.log(`[dry-run] apagaria: "${d.originalName}" (${d.id}) workspace=${d.workspaceId}`);
      continue;
    }
    await permanentlyDelete(d);
    console.log(`[removed] "${d.originalName}" (${d.id}) workspace=${d.workspaceId}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        platformId,
        dryRun,
        candidatos: stale.length,
      },
      null,
      2,
    ),
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error(e instanceof Error ? e.message : e);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  });
