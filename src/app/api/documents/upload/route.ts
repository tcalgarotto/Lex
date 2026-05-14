import { NextResponse } from "next/server";
import { DocumentLibraryShelf, DocumentStatus } from "@prisma/client";
import { nanoid } from "nanoid";
import { inngest } from "@/lib/inngest/client";
import { getWorkspaceContextWithRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { documentStoragePath, removeDocumentBuffer, uploadDocumentBuffer } from "@/lib/storage";
import { scheduleDocumentThumbnailWork } from "@/lib/documents/thumbnail-schedule";
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { getLogger } from "@/lib/logger";
import { ALLOWED_DOCUMENT_UPLOAD_MIME_TYPES, getMaxUploadFileSizeBytes } from "@/lib/documents/upload-constraints";
import {
  assertCanUploadFileToWorkspace,
  recalculateWorkspaceStorageUsage,
  storageUploadErrorResponse,
} from "@/lib/storage/storage-quota";

const log = getLogger("lex.api.documents.upload");

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { workspaceId, user } = await getWorkspaceContextWithRole();

  const rl = await rateLimit({
    key: `upload:${user.id}`,
    limit: 20,
    windowSeconds: 60,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many uploads. Tente novamente em alguns instantes." },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  const form = await req.formData();
  const file = form.get("file");
  const processIdRaw = form.get("processId");
  const processId =
    typeof processIdRaw === "string" && processIdRaw.length > 0 ? processIdRaw : null;
  const caseIdRaw = form.get("caseId");
  const caseId =
    typeof caseIdRaw === "string" && caseIdRaw.length > 0 ? caseIdRaw : null;

  /**
   * Catálogo global (leis/livros) só entra pela operação (scripts → workspace
   * `lex-platform-catalog`). Upload pela app fica sempre privado da equipa.
   */
  const libraryShelf = DocumentLibraryShelf.OFFICE_PRIVATE;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo obrigatório" }, { status: 400 });
  }

  const maxBytes = getMaxUploadFileSizeBytes();
  if (file.size > maxBytes) {
    return NextResponse.json(
      {
        code: "FILE_SIZE_EXCEEDS_PLAN_LIMIT",
        message: "Este arquivo excede o limite individual permitido para o seu plano.",
        maxFileSizeBytes: maxBytes,
        attemptedBytes: file.size,
      },
      { status: 413 },
    );
  }

  const mime = file.type || "application/octet-stream";
  if (!ALLOWED_DOCUMENT_UPLOAD_MIME_TYPES.has(mime)) {
    return NextResponse.json(
      { error: `Tipo não suportado: ${mime}. Aceitamos PDF, DOCX, TXT.` },
      { status: 415 },
    );
  }

  // Valida processId/caseId no escopo do workspace antes de tocar storage.
  if (processId) {
    const ok = await prisma.process.findFirst({
      where: { id: processId, workspaceId },
      select: { id: true },
    });
    if (!ok) {
      return NextResponse.json({ error: "Processo não encontrado" }, { status: 404 });
    }
  }
  if (caseId) {
    const ok = await prisma.case.findFirst({
      where: { id: caseId, workspaceId },
      select: { id: true },
    });
    if (!ok) {
      return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
    }
  }

  try {
    await assertCanUploadFileToWorkspace({ workspaceId, fileSizeBytes: file.size });
  } catch (e) {
    const resp = storageUploadErrorResponse(e);
    if (resp) return resp;
    throw e;
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length !== file.size) {
    return NextResponse.json({ error: "Tamanho do arquivo inconsistente" }, { status: 400 });
  }

  try {
    await assertCanUploadFileToWorkspace({ workspaceId, fileSizeBytes: buffer.length });
  } catch (e) {
    const resp = storageUploadErrorResponse(e);
    if (resp) return resp;
    throw e;
  }

  const documentId = nanoid();
  const path = documentStoragePath(workspaceId, documentId, file.name);

  try {
    await uploadDocumentBuffer({
      path,
      buffer,
      contentType: file.type || "application/octet-stream",
    });
  } catch (e) {
    log.warn("storage upload failed", {
      workspaceId,
      err: e instanceof Error ? { name: e.name, message: e.message } : { message: String(e) },
    });
    throw e;
  }

  try {
    const doc = await prisma.document.create({
      data: {
        id: documentId,
        workspaceId,
        processId,
        caseId,
        uploadedByUserId: user.id,
        libraryShelf,
        originalName: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: buffer.length,
        storagePath: path,
        status: DocumentStatus.UPLOADED,
      },
    });

    try {
      await inngest.send({ name: "lex/document.ingest", data: { documentId: doc.id } });
    } catch (e) {
      log.warn("inngest send failed (non-fatal)", {
        workspaceId,
        documentId: doc.id,
        err: e instanceof Error ? { name: e.name, message: e.message } : { message: String(e) },
      });
    }

    if (mime.includes("pdf") || file.name.toLowerCase().endsWith(".pdf")) {
      scheduleDocumentThumbnailWork(doc.id, { eagerBackground: true });
    }

    await prisma.activity.create({
      data: {
        workspaceId,
        kind: "document.uploaded",
        title: `Documento enviado: ${file.name}`,
        metaJson: { documentId: doc.id, processId, caseId, libraryShelf },
      },
    });

    if (caseId) {
      await prisma.caseTimelineEvent
        .create({
          data: {
            caseId,
            kind: "NOTE",
            message: `Documento "${file.name}" enviado para o caso.`,
            payloadJson: { documentId: doc.id, action: "document.uploaded" },
          },
        })
        .catch((err) => {
          log.warn("timeline event failed (non-fatal)", {
            workspaceId,
            caseId,
            documentId: doc.id,
            err: err instanceof Error ? { name: err.name, message: err.message } : { message: String(err) },
          });
        });
    }

    await recalculateWorkspaceStorageUsage(workspaceId);

    return NextResponse.json({ documentId: doc.id, status: doc.status, caseId });
  } catch (e) {
    await removeDocumentBuffer(path).catch(() => {});
    log.error("document create failed after storage upload", {
      workspaceId,
      documentId,
      err: e instanceof Error ? { name: e.name, message: e.message } : { message: String(e) },
    });
    throw e;
  }
}
