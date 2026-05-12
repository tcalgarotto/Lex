import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { userCanReadDocument } from "@/lib/documents/document-access";
import { downloadDocumentBuffer } from "@/lib/storage";
import { getLogger } from "@/lib/logger";

const log = getLogger("lex.api.documents.file");

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Ficheiro original no bucket (autenticado, escopo workspace).
 * Usado na página de leitura da Biblioteca (iframe / PDF).
 */
export async function GET(
  req: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await context.params;
  const { searchParams } = new URL(req.url);
  const asDownload = searchParams.get("download") === "1";

  const { workspaceId, user } = await getWorkspaceContext();

  const doc = await prisma.document.findFirst({
    where: { id: documentId, workspaceId, deletedAt: null },
    select: {
      id: true,
      mimeType: true,
      storagePath: true,
      originalName: true,
      libraryShelf: true,
      uploadedByUserId: true,
      caseId: true,
      processId: true,
    },
  });
  if (!doc) {
    return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });
  }
  if (!userCanReadDocument(user.id, doc)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  try {
    const buffer = await downloadDocumentBuffer(doc.storagePath);
    const disposition = asDownload ? "attachment" : "inline";
    const safeName = doc.originalName.replace(/[\r\n"]/g, "_");
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": doc.mimeType || "application/octet-stream",
        "Content-Disposition": `${disposition}; filename="${safeName}"`,
        "Cache-Control": "private, max-age=120",
      },
    });
  } catch (err) {
    log.warn("document file download failed", {
      documentId: doc.id,
      err: err instanceof Error ? { name: err.name, message: err.message } : { message: String(err) },
    });
    return NextResponse.json({ error: "Não foi possível obter o ficheiro" }, { status: 502 });
  }
}
