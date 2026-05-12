/**
 * Envia os ficheiros de `docs/Leis, Códigos e Normas/` para o storage e cria
 * `Document` com `libraryShelf = SHARED_LEGAL` (prateleira «Leis, códigos e normas» na Biblioteca).
 *
 * Uso (na raiz do repo):
 *   npx tsx --env-file=.env scripts/upload-leis-codigos-normas-to-library.ts
 *   npx tsx --env-file=.env scripts/upload-leis-codigos-normas-to-library.ts -- --workspace=<id|slug> --user=<userId>
 *   npx tsx --env-file=.env scripts/upload-leis-codigos-normas-to-library.ts -- --replace
 *
 * Idempotente: ignora se já existir documento com o mesmo `originalName` no mesmo
 * workspace e `SHARED_LEGAL`, salvo com `--replace` (remove o anterior e volta a enviar).
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
import { prisma } from "../src/lib/prisma";
import { documentStoragePath, removeDocumentBuffer, uploadDocumentBuffer } from "../src/lib/storage";
import { getQdrantVectorStore } from "../src/lib/retrieval/vector-store/qdrant-store";
import { inngest } from "../src/lib/inngest/client";

const DIR_SEGMENTS = ["docs", "Leis, Códigos e Normas"] as const;
const EXT = new Set([".pdf", ".docx", ".doc", ".txt"]);

function parseArgs(): { workspace?: string; user?: string; replace: boolean } {
  const out: { workspace?: string; user?: string; replace: boolean } = { replace: false };
  for (const a of process.argv.slice(2)) {
    if (a.startsWith("--workspace=")) out.workspace = a.slice("--workspace=".length);
    else if (a.startsWith("--user=")) out.user = a.slice("--user=".length);
    else if (a === "--replace") out.replace = true;
  }
  return out;
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
  const envId = process.env["LEX_LIBRARY_WORKSPACE_ID"]?.trim();
  if (envId) {
    const w = await prisma.workspace.findFirst({ where: { id: envId }, select: { id: true } });
    if (w) return w.id;
  }
  const first = await prisma.workspace.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!first) throw new Error("Nenhum workspace na base.");
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
    if (!ok) throw new Error("O utilizador precisa de ser advogado ou função superior para catálogo SHARED_LEGAL.");
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
  const { workspace: wsArg, user: userArg, replace } = parseArgs();
  const workspaceId = await resolveWorkspaceId(wsArg);
  const uploadedByUserId = await resolveUploaderUserId(workspaceId, userArg);
  if (!uploadedByUserId?.trim()) {
    throw new Error("Não foi possível determinar o utilizador remetente (uploadedByUserId).");
  }

  const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  const dir = path.join(repoRoot, ...DIR_SEGMENTS);
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

  console.log(JSON.stringify({ workspaceId, uploadedByUserId, replace, ficheiros: files }, null, 2));

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
        libraryShelf: DocumentLibraryShelf.SHARED_LEGAL,
        originalName: name,
        deletedAt: null,
      },
      select: { id: true, workspaceId: true, storagePath: true },
    });
    if (existing) {
      if (replace) {
        console.log(`[replace] remove SHARED_LEGAL existente: ${name} (${existing.id})`);
        await permanentlyDeleteDocument(existing);
      } else {
        console.log(`[skip] já existe SHARED_LEGAL: ${name} (${existing.id})`);
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
        libraryShelf: DocumentLibraryShelf.SHARED_LEGAL,
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
