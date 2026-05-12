import type { DocumentLibraryShelf } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  documentThumbnailLegacyPngStoragePath,
  documentThumbnailStoragePath,
  downloadDocumentBuffer,
  removeDocumentBuffer,
  tryDownloadDocumentBuffer,
  uploadDocumentBuffer,
} from "@/lib/storage";
import { isThumbnailMostlyBlankPng } from "@/lib/documents/pdf-thumbnail-blank";
import { maybeCropWideCatalogCoverPng } from "@/lib/documents/pdf-thumbnail-catalog-cover-crop";
import { tryRenderPdfThumbnailPngWithPoppler } from "@/lib/documents/pdf-thumbnail-poppler";
import { encodeDocumentThumbnailWebpFromPng } from "@/lib/documents/pdf-thumbnail-webp";
import { getLogger } from "@/lib/logger";

const log = getLogger("lex.document.thumbnail-persist");

const inflightPersist = new Map<string, Promise<void>>();

/** Bucket costuma aceitar `application/octet-stream` para miniaturas (evita rejeição por MIME). */
const THUMB_UPLOAD_CONTENT_TYPE = "application/octet-stream";

async function finalizeThumbnailPng(
  png: Buffer | ArrayBuffer,
  shelf: DocumentLibraryShelf,
): Promise<Buffer> {
  const buf = Buffer.isBuffer(png) ? png : Buffer.from(png);
  return maybeCropWideCatalogCoverPng(buf, shelf);
}

async function renderPdfThumbnailPngFromBuffer(
  pdfBuffer: Buffer,
  shelf: DocumentLibraryShelf,
): Promise<Buffer> {
  const popplerPng = await tryRenderPdfThumbnailPngWithPoppler(pdfBuffer);
  if (popplerPng) {
    return finalizeThumbnailPng(popplerPng, shelf);
  }

  const unpdf = await import("unpdf");
  const data = new Uint8Array(pdfBuffer);
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
        return finalizeThumbnailPng(png, shelf);
      }
    }
    if (fallback) {
      return finalizeThumbnailPng(fallback, shelf);
    }
    throw new Error("Nenhuma página renderizada");
  } finally {
    await pdf.destroy().catch(() => {});
  }
}

async function persistWebpFromPng(workspaceId: string, documentId: string, png: Buffer): Promise<void> {
  const webp = await encodeDocumentThumbnailWebpFromPng(png);
  const thumbPath = documentThumbnailStoragePath(workspaceId, documentId);
  await uploadDocumentBuffer({
    path: thumbPath,
    buffer: webp,
    contentType: THUMB_UPLOAD_CONTENT_TYPE,
  });
  await removeDocumentBuffer(documentThumbnailLegacyPngStoragePath(workspaceId, documentId));
}

/**
 * Gera e grava `__lex_thumbnail.webp` no Storage para o documento.
 * Idempotente: se o WebP já existir, sai logo. PNG legado é convertido em background (uma vez).
 * Deduplica execuções concorrentes.
 */
export async function ensurePdfThumbnailInStorage(documentId: string): Promise<void> {
  let run = inflightPersist.get(documentId);
  if (run) return run;

  run = (async () => {
    const doc = await prisma.document.findFirst({
      where: { id: documentId, deletedAt: null },
      select: {
        id: true,
        workspaceId: true,
        mimeType: true,
        storagePath: true,
        originalName: true,
        libraryShelf: true,
      },
    });
    if (!doc) return;

    const mt = doc.mimeType.toLowerCase();
    const isPdf = mt.includes("pdf") || doc.originalName.toLowerCase().endsWith(".pdf");
    if (!isPdf) return;

    const thumbPath = documentThumbnailStoragePath(doc.workspaceId, doc.id);
    const legacyPath = documentThumbnailLegacyPngStoragePath(doc.workspaceId, doc.id);

    const existingWebp = await tryDownloadDocumentBuffer(thumbPath);
    if (existingWebp) return;

    const legacyPng = await tryDownloadDocumentBuffer(legacyPath);
    if (legacyPng) {
      try {
        await persistWebpFromPng(doc.workspaceId, doc.id, legacyPng);
        return;
      } catch (err) {
        log.warn("thumbnail legacy png to webp failed", {
          documentId,
          err: err instanceof Error ? { name: err.name, message: err.message } : { message: String(err) },
        });
      }
    }

    try {
      const pdfBuffer = await downloadDocumentBuffer(doc.storagePath);
      const png = await renderPdfThumbnailPngFromBuffer(pdfBuffer, doc.libraryShelf);
      await persistWebpFromPng(doc.workspaceId, doc.id, png);
    } catch (err) {
      log.warn("thumbnail generation failed", {
        documentId,
        err: err instanceof Error ? { name: err.name, message: err.message } : { message: String(err) },
      });
    }
  })().finally(() => {
    inflightPersist.delete(documentId);
  });

  inflightPersist.set(documentId, run);
  return run;
}
