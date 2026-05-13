/**
 * Envia os ficheiros de `docs/Leis, Códigos e Normas/` (predefinição) ou de outra pasta
 * (`--dir=...` relativo à raiz do repo) para o storage e cria
 * `Document` com `libraryShelf = SHARED_LEGAL` (predefinição) ou `SHARED_BOOKS` com `--shelf=SHARED_BOOKS`.
 *
 * Destino **recomendado**: workspace global `lex-platform-catalog` (sem `uploadedByUserId`), visível
 * na Biblioteca de **todos** os utilizadores. Criar o workspace:
 *   npx tsx --env-file=.env scripts/ensure-platform-library-workspace.ts
 * Opcional: `LEX_PLATFORM_LIBRARY_WORKSPACE_ID=<id>` no `.env`.
 *
 * Uso (na raiz do repo):
 *   npx tsx --env-file=.env scripts/upload-leis-codigos-normas-to-library.ts
 *   npx tsx --env-file=.env scripts/upload-leis-codigos-normas-to-library.ts -- --workspace=<id|slug> --user=<userId>
 *   npx tsx --env-file=.env scripts/upload-leis-codigos-normas-to-library.ts -- --shelf=SHARED_BOOKS
 *   npx tsx --env-file=.env scripts/upload-leis-codigos-normas-to-library.ts -- --shelf=SHARED_BOOKS --dir="docs/Livros recomendados"
 *
 * Idempotente: ignora se já existir documento com o mesmo `originalName` no mesmo
 * workspace e mesma prateleira (`SHARED_LEGAL` ou `SHARED_BOOKS`), salvo com `--replace`.
 *
 * Ficheiros sem extensão: se o conteúdo for PDF (`%PDF`), são aceites como `application/pdf`.
 *
 * Se **só** mudou o nome do ficheiro (mesmo PDF no storage), prefira renomear o registo:
 *   `npx tsx --env-file=.env scripts/rename-library-documents.ts -- --map="NomeAntigo=>NomeNovo"`
 * Assim evita duplicados e novo upload desnecessário.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { nanoid } from "nanoid";
import { DocumentLibraryShelf, DocumentStatus, MembershipRole } from "@prisma/client";

import "../src/lib/env-normalize";
import {
  getPlatformLibraryWorkspaceId,
  isPlatformCatalogDocumentWorkspace,
  PLATFORM_LIBRARY_WORKSPACE_SLUG,
} from "../src/lib/biblioteca/platform-library";
import { prisma } from "../src/lib/prisma";
import { documentStoragePath, removeDocumentBuffer, uploadDocumentBuffer } from "../src/lib/storage";
import { getQdrantVectorStore } from "../src/lib/retrieval/vector-store/qdrant-store";
import { inngest } from "../src/lib/inngest/client";

const DEFAULT_DIR_REL = path.join("docs", "Leis, Códigos e Normas");
const EXT = new Set([".pdf", ".docx", ".doc", ".txt"]);

function parseArgs(): {
  workspace?: string;
  user?: string;
  replace: boolean;
  shelf: DocumentLibraryShelf;
  /** Caminho relativo à raiz do repo (ex.: docs/Livros recomendados). */
  dirRel?: string;
} {
  const out: {
    workspace?: string;
    user?: string;
    replace: boolean;
    shelf: DocumentLibraryShelf;
    dirRel?: string;
  } = { replace: false, shelf: DocumentLibraryShelf.SHARED_LEGAL };
  for (const a of process.argv.slice(2)) {
    if (a.startsWith("--workspace=")) out.workspace = a.slice("--workspace=".length);
    else if (a.startsWith("--user=")) out.user = a.slice("--user=".length);
    else if (a === "--replace") out.replace = true;
    else if (a.startsWith("--dir=")) out.dirRel = a.slice("--dir=".length).trim();
    else if (a.startsWith("--shelf=")) {
      const v = a.slice("--shelf=".length).trim();
      if (v === "SHARED_LEGAL" || v === "SHARED_BOOKS") {
        out.shelf = v as DocumentLibraryShelf;
      } else {
        throw new Error(`--shelf inválido: ${v} (use SHARED_LEGAL ou SHARED_BOOKS)`);
      }
    }
  }
  return out;
}

function resolveSourceDir(repoRoot: string, dirRel?: string): string {
  const rel = (dirRel?.trim() || DEFAULT_DIR_REL).replace(/\\/g, path.sep);
  const abs = path.resolve(repoRoot, rel);
  const root = path.resolve(repoRoot);
  const relCheck = path.relative(root, abs);
  if (relCheck.startsWith("..") || path.isAbsolute(relCheck)) {
    throw new Error(`--dir fora da raiz do repositório: ${dirRel ?? DEFAULT_DIR_REL}`);
  }
  return abs;
}

function isPdfMagic(buf: Buffer): boolean {
  return buf.length >= 5 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46; // %PDF
}

async function permanentlyDeleteDocument(doc: {
  id: string;
  workspaceId: string;
  storagePath: string;
}): Promise<void> {
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

async function resolveWorkspaceId(arg?: string): Promise<string> {
  if (arg?.trim()) {
    const w = await prisma.workspace.findFirst({
      where: { OR: [{ id: arg.trim() }, { slug: arg.trim() }] },
      select: { id: true },
    });
    if (w) return w.id;
    throw new Error(`Workspace não encontrado: ${arg}`);
  }
  const platform = await getPlatformLibraryWorkspaceId();
  if (platform) return platform;

  const bySlug = await prisma.workspace.findFirst({
    where: { slug: PLATFORM_LIBRARY_WORKSPACE_SLUG },
    select: { id: true },
  });
  if (bySlug) return bySlug.id;

  const legacy = process.env["LEX_LIBRARY_WORKSPACE_ID"]?.trim();
  if (legacy) {
    const w = await prisma.workspace.findFirst({
      where: { OR: [{ id: legacy }, { slug: legacy }] },
      select: { id: true },
    });
    if (w) {
      console.warn(
        "[warn] LEX_LIBRARY_WORKSPACE_ID aponta para um workspace de equipa. Para catálogo global, use scripts/ensure-platform-library-workspace.ts e LEX_PLATFORM_LIBRARY_WORKSPACE_ID.",
      );
      return w.id;
    }
  }
  const first = await prisma.workspace.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!first) throw new Error("Nenhum workspace na base.");
  console.warn(
    "[warn] Sem workspace lex-platform-catalog: a usar o primeiro workspace. Execute scripts/ensure-platform-library-workspace.ts.",
  );
  return first.id;
}

async function resolveUploaderUserId(workspaceId: string, userArg?: string): Promise<string> {
  if (userArg?.trim()) {
    const m = await prisma.membership.findFirst({
      where: { workspaceId, userId: userArg.trim() },
      select: { userId: true, role: true },
    });
    if (!m) throw new Error(`Utilizador sem membership neste workspace: ${userArg}`);
    const ok =
      m.role === MembershipRole.OWNER ||
      m.role === MembershipRole.ADMIN ||
      m.role === MembershipRole.LAWYER;
    if (!ok) throw new Error("O utilizador precisa de ser advogado ou função superior para catálogo partilhado (SHARED_*).");
    return m.userId;
  }
  const m = await prisma.membership.findFirst({
    where: {
      workspaceId,
      role: { in: [MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.LAWYER] },
    },
    orderBy: { createdAt: "asc" },
    select: { userId: true },
  });
  if (!m) throw new Error("Nenhum advogado (ou superior) neste workspace para atribuir uploadedBy.");
  return m.userId;
}

function mimeFor(fileName: string, buffer: Buffer): string | null {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".doc")) return "application/msword";
  if (lower.endsWith(".txt")) return "text/plain";
  if (path.extname(lower) === "" && isPdfMagic(buffer)) return "application/pdf";
  return null;
}

async function main() {
  const { workspace: wsArg, user: userArg, replace, shelf: targetShelf, dirRel } = parseArgs();
  const workspaceId = await resolveWorkspaceId(wsArg);
  const systemCatalog = await isPlatformCatalogDocumentWorkspace(workspaceId);
  const uploadedByUserId = systemCatalog ? null : await resolveUploaderUserId(workspaceId, userArg);
  if (!systemCatalog && !uploadedByUserId?.trim()) {
    throw new Error("Não foi possível determinar o utilizador remetente (uploadedByUserId).");
  }

  const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  const dir = resolveSourceDir(repoRoot, dirRel);
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch (e) {
    throw new Error(`Pasta não encontrada: ${dir} (${e instanceof Error ? e.message : String(e)})`);
  }

  const candidates = names.filter((n) => !n.startsWith("."));
  const files: string[] = [];
  for (const n of candidates) {
    const fp = path.join(dir, n);
    const st = await fs.stat(fp).catch(() => null);
    if (!st?.isFile()) continue;
    const ext = path.extname(n).toLowerCase();
    if (EXT.has(ext)) {
      files.push(n);
      continue;
    }
    if (ext === "") {
      try {
        const fh = await fs.open(fp, "r");
        try {
          const buf = Buffer.allocUnsafe(5);
          const { bytesRead } = await fh.read(buf, 0, 5, 0);
          if (bytesRead >= 5 && isPdfMagic(buf)) files.push(n);
        } finally {
          await fh.close();
        }
      } catch {
        /* ignore */
      }
    }
  }

  if (files.length === 0) {
    console.log(`Nada para enviar em ${dir} (PDF/DOC/DOCX/TXT ou PDF sem extensão)`);
    return;
  }

  console.log(
    JSON.stringify(
      { workspaceId, uploadedByUserId, replace, shelf: targetShelf, ficheiros: files },
      null,
      2,
    ),
  );

  for (const name of files) {
    const filePath = path.join(dir, name);
    const buffer = await fs.readFile(filePath);
    const mimeType = mimeFor(name, buffer);
    if (!mimeType) {
      console.log(`[skip] tipo não suportado: ${name}`);
      continue;
    }

    const existing = await prisma.document.findFirst({
      where: {
        workspaceId,
        libraryShelf: targetShelf,
        originalName: name,
        deletedAt: null,
      },
      select: { id: true, workspaceId: true, storagePath: true },
    });
    if (existing) {
      if (replace) {
        console.log(`[replace] remove ${targetShelf} existente: ${name} (${existing.id})`);
        await permanentlyDeleteDocument(existing);
      } else {
        console.log(`[skip] já existe ${targetShelf}: ${name} (${existing.id})`);
        continue;
      }
    }

    const documentId = nanoid();
    const storagePath = documentStoragePath(workspaceId, documentId, name);

    await uploadDocumentBuffer({
      path: storagePath,
      buffer,
      contentType: mimeType,
    });

    await prisma.document.create({
      data: {
        id: documentId,
        workspaceId,
        uploadedByUserId,
        libraryShelf: targetShelf,
        originalName: name,
        mimeType,
        sizeBytes: buffer.length,
        storagePath,
        status: DocumentStatus.UPLOADED,
      },
    });

    try {
      await inngest.send({ name: "lex/document.ingest", data: { documentId } });
    } catch {
      console.warn(`[warn] Inngest ingest não enviado para ${documentId}; pode reprocessar na UI.`);
    }

    console.log(`[ok] ${name} → document ${documentId}`);
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
