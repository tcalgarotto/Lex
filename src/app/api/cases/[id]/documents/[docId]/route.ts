/**
 * P0 — Case Brain pipeline (entrevista → dados → persistência).
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/CASE_BRAIN.md
 */

import { NextResponse } from "next/server";
import { DocumentStatus } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { findCaseInWorkspace } from "@/lib/cases/case-brain/api-case-access";
import { classifyDocumentFromNameAndText } from "@/lib/cases/case-brain/document-suggestions";


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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const { workspaceId } = await getWorkspaceContext();
  const { id: caseId, docId } = await params;
  if (!(await findCaseInWorkspace(workspaceId, caseId))) {
    return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
  }
  const d = await prisma.document.findFirst({
    where: { id: docId, caseId, workspaceId, deletedAt: null },
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      status: true,
      sizeBytes: true,
      errorMessage: true,
      progress: true,
      extractedText: true,
      extractedAt: true,
      updatedAt: true,
      createdAt: true,
    },
  });
  if (!d) {
    return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });
  }
  const text = d.extractedText ?? "";
  const classification = classifyDocumentFromNameAndText(d.originalName, text);
  return NextResponse.json({
    document: {
      ...d,
      uiStatus: mapUiStatus(d.status, Boolean(text.length)),
      classification,
      extractedPreview: text ? text.slice(0, 8000) : null,
    },
  });
}
