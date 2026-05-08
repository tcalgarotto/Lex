import { NextResponse } from "next/server";
import { DocumentStatus } from "@prisma/client";
import { nanoid } from "nanoid";
import { inngest } from "@/lib/inngest/client";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { documentStoragePath, uploadDocumentBuffer } from "@/lib/storage";
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";

export const runtime = "nodejs";

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB — alinhado ao bucket
const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "application/octet-stream",
]);

export async function POST(req: Request) {
  const { workspaceId, user } = await getWorkspaceContext();

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
      processId,
      caseId,
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
    console.error("Inngest send failed", e);
  }

  await prisma.activity.create({
    data: {
      workspaceId,
      kind: "document.uploaded",
      title: `Documento enviado: ${file.name}`,
      metaJson: { documentId: doc.id, processId, caseId },
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
        console.error("[upload] timeline event failed (non-fatal)", err);
      });
  }

  return NextResponse.json({ documentId: doc.id, status: doc.status, caseId });
}
