/**
 * Atualiza só o campo `originalName` de documentos do catálogo (ex.: SHARED_LEGAL).
 * O ficheiro no storage mantém-se — útil quando só mudou o nome visível / nome no disco.
 *
 * Não use isto para substituir o conteúdo binário; para isso, reenvie com
 * `upload-leis-codigos-normas-to-library.ts --replace`.
 *
 * Uso:
 *   npx tsx --env-file=.env scripts/rename-library-documents.ts -- --map="NomeAntigo=>NomeNovo"
 *   npx tsx --env-file=.env scripts/rename-library-documents.ts -- --workspace=<id|slug> --shelf=SHARED_LEGAL --map="a.pdf=>b.pdf,c.pdf=>d.pdf"
 */

import { DocumentLibraryShelf } from "@prisma/client";

import "../src/lib/env-normalize";
import { prisma } from "../src/lib/prisma";

function parseArgs(): {
  workspace?: string;
  shelf: DocumentLibraryShelf;
  map: Array<{ from: string; to: string }>;
} {
  const out: {
    workspace?: string;
    shelf: DocumentLibraryShelf;
    map: Array<{ from: string; to: string }>;
  } = {
    shelf: DocumentLibraryShelf.SHARED_LEGAL,
    map: [],
  };

  for (const a of process.argv.slice(2)) {
    if (a.startsWith("--workspace=")) out.workspace = a.slice("--workspace=".length);
    else if (a.startsWith("--shelf=")) {
      const v = a.slice("--shelf=".length).trim();
      if (v === "SHARED_LEGAL" || v === "SHARED_BOOKS") {
        out.shelf = v as DocumentLibraryShelf;
      } else {
        throw new Error(`--shelf inválido: ${v} (use SHARED_LEGAL ou SHARED_BOOKS)`);
      }
    } else if (a.startsWith("--map=")) {
      const raw = a.slice("--map=".length).trim();
      for (const part of raw.split(",")) {
        const seg = part.trim();
        if (!seg) continue;
        const i = seg.indexOf("=>");
        if (i < 1) throw new Error(`Par inválido (use antigo=>novo): ${seg}`);
        const from = seg.slice(0, i).trim();
        const to = seg.slice(i + 2).trim();
        if (!from || !to) throw new Error(`Par vazio: ${seg}`);
        out.map.push({ from, to });
      }
    }
  }

  if (out.map.length === 0) {
    throw new Error("Indique pelo menos um par com --map=\"nomeAntigo=>nomeNovo\" (vários separados por vírgula).");
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

async function main() {
  const { workspace: wsArg, shelf, map } = parseArgs();
  const workspaceId = await resolveWorkspaceId(wsArg);

  for (const { from, to } of map) {
    const targetExists = await prisma.document.findFirst({
      where: {
        workspaceId,
        libraryShelf: shelf,
        originalName: to,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (targetExists) {
      throw new Error(
        `Já existe documento com nome destino "${to}" (${targetExists.id}). Resolva o conflito antes de renomear "${from}".`,
      );
    }

    const doc = await prisma.document.findFirst({
      where: {
        workspaceId,
        libraryShelf: shelf,
        originalName: from,
        deletedAt: null,
      },
      select: { id: true, originalName: true },
    });

    if (!doc) {
      console.warn(`[skip] não encontrado: "${from}" (${shelf})`);
      continue;
    }

    await prisma.document.update({
      where: { id: doc.id },
      data: { originalName: to },
    });
    console.log(`[ok] "${from}" → "${to}" (${doc.id})`);
  }
}

main()
  .then(async () => {
    console.log("Concluído.");
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error(e instanceof Error ? e.message : e);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  });
