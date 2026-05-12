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
import { documentStoragePath, uploadDocumentBuffer } from "@/lib/storage";
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { getLogger } from "@/lib/logger";
import { findCaseInWorkspace } from "@/lib/cases/case-brain/api-case-access";
import { recordCaseMutationActivity } from "@/lib/cases/case-brain/activity-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const log = getLogger("lex.api.cases.documents");

const MAX_BYTES = 50 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "application/octet-stream",
]);

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
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `Arquivo excede ${(MAX_BYTES / 1024 / 1024).toFixed(0)} MB.` },
      { status: 413 },
    );
  }
  const mime = file.type || "application/octet-stream";
  if (!ALLOWED_MIME.has(mime)) {
    return NextResponse.json(
      { error: `Tipo não suportado. Aceitamos PDF, DOCX, TXT.` },
      { status: 415 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const documentId = nanoid();
  const path = documentStoragePath(workspaceId, documentId, file.name);

  await uploadDocumentBuffer({
    path,
    buffer,
    contentType: file.type || "application/octet-stream",
  });

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

  return NextResponse.json({
    documentId: doc.id,
    status: doc.status,
    uiStatus: mapUiStatus(doc.status, false),
    caseId,
  });
}
