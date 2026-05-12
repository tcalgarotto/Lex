/**
 * Remove documentos do catálogo (SHARED_LEGAL ou SHARED_BOOKS) pelos nomes exatos
 * em `originalName` — Qdrant, Storage e Postgres (igual ao DELETE da API).
 *
 * Listar o que existe (para ver nomes antigos / duplicados):
 *   npx tsx --env-file=.env scripts/delete-catalog-documents-by-name.ts -- --list
 *   npx tsx --env-file=.env scripts/delete-catalog-documents-by-name.ts -- --list --shelf=SHARED_BOOKS
 *
 * Apagar por nome(s):
 *   npx tsx --env-file=.env scripts/delete-catalog-documents-by-name.ts -- --names="Nome antigo 1,Nome antigo 2"
 *   npx tsx --env-file=.env scripts/delete-catalog-documents-by-name.ts -- --workspace=<id|slug> --names="..."
 *
 * Simular sem apagar:
 *   npx tsx --env-file=.env scripts/delete-catalog-documents-by-name.ts -- --names="X" --dry-run
 */

import { DocumentLibraryShelf } from "@prisma/client";

import "../src/lib/env-normalize";
import { prisma } from "../src/lib/prisma";
import { removeDocumentBuffer } from "../src/lib/storage";
import { getQdrantVectorStore } from "../src/lib/retrieval/vector-store/qdrant-store";

function parseArgs(): {
  workspace?: string;
  shelf: DocumentLibraryShelf;
  list: boolean;
  dryRun: boolean;
  names: string[];
} {
  const out: {
    workspace?: string;
    shelf: DocumentLibraryShelf;
    list: boolean;
    dryRun: boolean;
    names: string[];
  } = {
    shelf: DocumentLibraryShelf.SHARED_LEGAL,
    list: false,
    dryRun: false,
    names: [],
  };

  for (const a of process.argv.slice(2)) {
    if (a.startsWith("--workspace=")) out.workspace = a.slice("--workspace=".length);
    else if (a.startsWith("--shelf=")) {
      const v = a.slice("--shelf=".length).trim();
      if (v === "SHARED_LEGAL" || v === "SHARED_BOOKS") {
        out.shelf = v as DocumentLibraryShelf;
      } else {
        throw new Error(`--shelf inválido: ${v}`);
      }
    } else if (a === "--list") out.list = true;
    else if (a === "--dry-run") out.dryRun = true;
    else if (a.startsWith("--names=")) {
      const raw = a.slice("--names=".length).trim();
      out.names.push(
        ...raw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      );
    }
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
  const { workspace: wsArg, shelf, list, dryRun, names } = parseArgs();
  const workspaceId = await resolveWorkspaceId(wsArg);

  if (list) {
    const docs = await prisma.document.findMany({
      where: {
        workspaceId,
        libraryShelf: shelf,
        deletedAt: null,
      },
      select: { id: true, originalName: true, createdAt: true, mimeType: true },
      orderBy: { createdAt: "asc" },
    });
    console.log(JSON.stringify({ workspaceId, shelf, total: docs.length, documentos: docs }, null, 2));
    return;
  }

  if (names.length === 0) {
    throw new Error("Use --names=\"nome1,nome2\" ou --list para ver o catálogo.");
  }

  let removed = 0;
  for (const originalName of names) {
    const doc = await prisma.document.findFirst({
      where: {
        workspaceId,
        libraryShelf: shelf,
        originalName,
        deletedAt: null,
      },
      select: { id: true, workspaceId: true, storagePath: true, originalName: true },
    });

    if (!doc) {
      console.warn(`[skip] não encontrado: "${originalName}" (${shelf})`);
      continue;
    }

    if (dryRun) {
      console.log(`[dry-run] apagaria: "${doc.originalName}" (${doc.id})`);
      removed++;
      continue;
    }

    await permanentlyDelete(doc);
    console.log(`[removed] "${doc.originalName}" (${doc.id})`);
    removed++;
  }

  console.log(JSON.stringify({ workspaceId, shelf, dryRun, removidos: removed }, null, 2));
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
