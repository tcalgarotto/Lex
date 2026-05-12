/**
 * Remove todos os documentos da prateleira «Livros em destaque» (SHARED_BOOKS)
 * num workspace: Qdrant, Storage e Postgres (igual ao DELETE da API).
 *
 * Uso:
 *   npx tsx --env-file=.env scripts/remove-shared-books.ts
 *   npx tsx --env-file=.env scripts/remove-shared-books.ts -- --workspace=<id|slug>
 */

import { DocumentLibraryShelf } from "@prisma/client";

import "../src/lib/env-normalize";
import { prisma } from "../src/lib/prisma";
import { removeDocumentBuffer } from "../src/lib/storage";
import { getQdrantVectorStore } from "../src/lib/retrieval/vector-store/qdrant-store";

function parseArgs(): { workspace?: string } {
  const out: { workspace?: string } = {};
  for (const a of process.argv.slice(2)) {
    if (a.startsWith("--workspace=")) out.workspace = a.slice("--workspace=".length);
  }
  return out;
}

async function resolveWorkspaceId(arg?: string): Promise<string> {
  if (arg?.trim()) {
    const w = await prisma.workspace.findFirst({
      where: { OR: [{ id: arg.trim() }, { slug: arg.trim() }] },
      select: { id: true },
    });
    if (w) return w.id;
    throw new Error(`Workspace não encontrado: ${arg}`);
  }
  const envId = process.env["LEX_LIBRARY_WORKSPACE_ID"]?.trim();
  if (envId) {
    const w = await prisma.workspace.findFirst({ where: { id: envId }, select: { id: true } });
    if (w) return w.id;
  }
  const first = await prisma.workspace.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!first) throw new Error("Nenhum workspace na base.");
  return first.id;
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
  const { workspace: wsArg } = parseArgs();
  const workspaceId = await resolveWorkspaceId(wsArg);

  const docs = await prisma.document.findMany({
    where: {
      workspaceId,
      libraryShelf: DocumentLibraryShelf.SHARED_BOOKS,
      deletedAt: null,
    },
    select: { id: true, workspaceId: true, storagePath: true, originalName: true },
  });

  if (docs.length === 0) {
    console.log(JSON.stringify({ workspaceId, removidos: 0, message: "Nenhum SHARED_BOOKS." }, null, 2));
    return;
  }

  for (const d of docs) {
    await permanentlyDelete(d);
    console.log(`[removed] ${d.originalName} (${d.id})`);
  }

  console.log(JSON.stringify({ workspaceId, removidos: docs.length }, null, 2));
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
