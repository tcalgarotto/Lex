import { NextResponse } from "next/server";
import type { DocumentLibraryShelf } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { userCanReadDocument } from "@/lib/documents/document-access";
import { downloadDocumentBuffer } from "@/lib/storage";
import { isThumbnailMostlyBlankPng } from "@/lib/documents/pdf-thumbnail-blank";
import { maybeCropWideCatalogCoverPng } from "@/lib/documents/pdf-thumbnail-catalog-cover-crop";
import { tryRenderPdfThumbnailPngWithPoppler } from "@/lib/documents/pdf-thumbnail-poppler";
import { getLogger } from "@/lib/logger";

const log = getLogger("lex.api.documents.thumbnail");

async function finalizeThumbnailPng(
  png: Buffer | ArrayBuffer,
  shelf: DocumentLibraryShelf,
): Promise<Buffer> {
  const buf = Buffer.isBuffer(png) ? png : Buffer.from(png);
  return maybeCropWideCatalogCoverPng(buf, shelf);
}

export const dynamic = "force-dynamic";
/** `unpdf` + `@napi-rs/canvas` não são suportados no Edge. */
export const runtime = "nodejs";

/**
 * PNG de pré-visualização do PDF (workspace-scoped), usado na Biblioteca.
 * Em ambientes com Poppler (`pdftocairo`, ex. imagem Docker), tenta primeiro páginas
 * 1…N — melhor descodificação de JP2/JBIG2. Caso contrário (ou se ainda “branco”),
 * usa `unpdf` + `@napi-rs/canvas`.
 */
export async function GET(
  _req: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await context.params;
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

  const mt = doc.mimeType.toLowerCase();
  const isPdf = mt.includes("pdf") || doc.originalName.toLowerCase().endsWith(".pdf");
  if (!isPdf) {
    return NextResponse.json({ error: "Miniatura disponível apenas para PDF" }, { status: 415 });
  }

  try {
    const buffer = await downloadDocumentBuffer(doc.storagePath);

    const popplerPng = await tryRenderPdfThumbnailPngWithPoppler(buffer);
    if (popplerPng) {
      const out = await finalizeThumbnailPng(popplerPng, doc.libraryShelf);
      return new NextResponse(new Uint8Array(out), {
        status: 200,
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "private, max-age=300",
        },
      });
    }

    const unpdf = await import("unpdf");
    const data = new Uint8Array(buffer);
    const pdf = await unpdf.getDocumentProxy(data);
    const numPages = pdf.numPages;
    const renderOpts = {
      scale: 0.42,
      canvasImport: () => import("@napi-rs/canvas"),
    } as const;
    const maxTry = Math.min(numPages, 10);
    let fallback: ArrayBuffer | null = null;

    try {
      for (let page = 1; page <= maxTry; page++) {
        const png = await unpdf.renderPageAsImage(data, page, renderOpts);
        if (!(png instanceof ArrayBuffer)) continue;
        if (!fallback) fallback = png;
        const blank = await isThumbnailMostlyBlankPng(png);
        if (!blank) {
          const out = await finalizeThumbnailPng(png, doc.libraryShelf);
          return new NextResponse(new Uint8Array(out), {
            status: 200,
            headers: {
              "Content-Type": "image/png",
              "Cache-Control": "private, max-age=300",
            },
          });
        }
      }
      if (fallback) {
        const out = await finalizeThumbnailPng(fallback, doc.libraryShelf);
        return new NextResponse(new Uint8Array(out), {
          status: 200,
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "private, max-age=300",
          },
        });
      }
      throw new Error("Nenhuma página renderizada");
    } finally {
      await pdf.destroy().catch(() => {});
    }
  } catch (err) {
    log.warn("thumbnail render failed", {
      documentId: doc.id,
      err: err instanceof Error ? { name: err.name, message: err.message } : { message: String(err) },
    });
    return NextResponse.json({ error: "Não foi possível gerar a miniatura" }, { status: 502 });
  }
}
