/**
 * P0 — Case Brain pipeline (entrevista → dados → persistência).
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/CASE_BRAIN.md
 */

import { NextResponse } from "next/server";
import { DocumentLibraryShelf, DocumentStatus } from "@prisma/client";
import { nanoid } from "nanoid";
import { inngest } from "@/lib/inngest/client";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { documentStoragePath, removeDocumentBuffer, uploadDocumentBuffer } from "@/lib/storage";
import { scheduleDocumentThumbnailWork } from "@/lib/documents/thumbnail-schedule";
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { getLogger } from "@/lib/logger";
import { findCaseInWorkspace } from "@/lib/cases/case-brain/api-case-access";
import { recordCaseMutationActivity } from "@/lib/cases/case-brain/activity-log";
import { ALLOWED_DOCUMENT_UPLOAD_MIME_TYPES, getMaxUploadFileSizeBytes } from "@/lib/documents/upload-constraints";
import {
  assertCanUploadFileToWorkspace,
  recalculateWorkspaceStorageUsage,
  storageUploadErrorResponse,
} from "@/lib/storage/storage-quota";

export const runtime = "nodejs";

const log = getLogger("lex.api.cases.documents");

function mapUiStatus(status: DocumentStatus, hasText: boolean): string {
  if (status === DocumentStatus.FAILED) return "FAILED";
  if (status === DocumentStatus.UPLOADED) return "PROCESSING";
  if (
    status === DocumentStatus.PARSING ||
    status === DocumentStatus.CHUNKING ||
    status === DocumentStatus.EMBEDDING
  ) {
    return "PROCESSING";
  }
  if (status === DocumentStatus.INDEXED && hasText) return "READY";
  if (status === DocumentStatus.INDEXED) return "READY";
  return "PROCESSING";
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { workspaceId } = await getWorkspaceContext();
  const { id: caseId } = await params;
  if (!(await findCaseInWorkspace(workspaceId, caseId))) {
    return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
  }
  const docs = await prisma.document.findMany({
    where: { caseId, workspaceId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      status: true,
      extractedText: true,
      errorMessage: true,
      progress: true,
      updatedAt: true,
      createdAt: true,
    },
  });
  return NextResponse.json({
    documents: docs.map((d) => ({
      ...d,
      uiStatus: mapUiStatus(d.status, Boolean(d.extractedText?.length)),
      extractedPreview: d.extractedText ? d.extractedText.slice(0, 4000) : null,
    })),
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { workspaceId, user } = await getWorkspaceContext();
  const { id: caseId } = await params;

  const rl = await rateLimit({
    key: `case-doc:${user.id}`,
    limit: 20,
    windowSeconds: 60,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Muitos envios. Aguarde um instante." },
      { status: 429, headers: rateLimitHeaders(rl) },
    );
  }

  if (!(await findCaseInWorkspace(workspaceId, caseId))) {
    return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
  }

  const form = await req.formData();
  const file = form.get("file");
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
      { error: `Tipo não suportado. Aceitamos PDF, DOCX, TXT.` },
      { status: 415 },
    );
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
        caseId,
        uploadedByUserId: user.id,
        libraryShelf: DocumentLibraryShelf.OFFICE_PRIVATE,
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

    await recordCaseMutationActivity({
      workspaceId,
      kind: "case.document.upload",
      title: `Documento enviado ao caso`,
      meta: { caseId, documentId: doc.id },
    });

    await prisma.caseTimelineEvent.create({
      data: {
        caseId,
        kind: "NOTE",
        message: `Documento "${file.name}" enviado (em processamento).`,
        payloadJson: { documentId: doc.id, action: "document.uploaded" },
        ...(user?.id ? { userId: user.id } : {}),
      },
    });

    await recalculateWorkspaceStorageUsage(workspaceId);

    return NextResponse.json({
      documentId: doc.id,
      status: doc.status,
      uiStatus: mapUiStatus(doc.status, false),
      caseId,
    });
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
