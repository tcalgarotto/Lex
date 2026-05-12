import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { documentReadScopeOr } from "@/lib/biblioteca/platform-library";
import { userCanReadDocument } from "@/lib/documents/document-access";
import {
  documentThumbnailLegacyPngStoragePath,
  documentThumbnailStoragePath,
  tryDownloadDocumentBuffer,
} from "@/lib/storage";
import { ensurePdfThumbnailInStorage } from "@/lib/documents/document-thumbnail-persist";
import { serverTimingHeader } from "@/lib/dev/server-timing";
import { getLogger } from "@/lib/logger";

const log = getLogger("lex.api.documents.thumbnail");

const THUMB_CACHE_CONTROL = "private, max-age=604800, stale-while-revalidate=86400";

/** `unpdf` + `@napi-rs/canvas` + `sharp` não são suportados no Edge. */
export const runtime = "nodejs";

function weakEtagForBuffer(buf: Buffer): string {
  return `W/"${createHash("sha256").update(buf).digest("hex").slice(0, 32)}"`;
}

async function loadAuthorizedDoc(documentId: string, workspaceId: string) {
  const readScope = await documentReadScopeOr(workspaceId);
  return prisma.document.findFirst({
    where: { id: documentId, deletedAt: null, OR: readScope },
    select: {
      id: true,
      workspaceId: true,
      mimeType: true,
      originalName: true,
      libraryShelf: true,
      uploadedByUserId: true,
      caseId: true,
      processId: true,
      updatedAt: true,
    },
  });
}

/**
 * Miniatura da primeira página do PDF (WebP quando disponível; fallback PNG legado).
 * 1) Se existir no Storage, serve de imediato.
 * 2) Caso contrário, gera (Inngest/after ou sync em `ensurePdfThumbnailInStorage`) e devolve.
 */
export async function GET(
  req: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await context.params;
  const { workspaceId, user } = await getWorkspaceContext();
  const marks: { name: string; dur: number }[] = [];
  const t0 = performance.now();

  const tDb = performance.now();
  const doc = await loadAuthorizedDoc(documentId, workspaceId);
  marks.push({ name: "db", dur: performance.now() - tDb });

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

  const webpPath = documentThumbnailStoragePath(doc.workspaceId, doc.id);
  const legacyPngPath = documentThumbnailLegacyPngStoragePath(doc.workspaceId, doc.id);

  const tStorage = performance.now();
  let image: Buffer | null = null;
  let contentType: "image/webp" | "image/png" = "image/webp";
  try {
    image = await tryDownloadDocumentBuffer(webpPath);
  } catch (err) {
    log.warn("thumbnail storage read failed", {
      documentId: doc.id,
      err: err instanceof Error ? { name: err.name, message: err.message } : { message: String(err) },
    });
  }
  marks.push({ name: "storage", dur: performance.now() - tStorage });

  if (!image) {
    const tGen = performance.now();
    await ensurePdfThumbnailInStorage(doc.id);
    marks.push({ name: "generate", dur: performance.now() - tGen });
    try {
      image = await tryDownloadDocumentBuffer(webpPath);
    } catch (err) {
      log.warn("thumbnail storage read after generate failed", {
        documentId: doc.id,
        err: err instanceof Error ? { name: err.name, message: err.message } : { message: String(err) },
      });
    }
  }

  if (!image) {
    try {
      const legacy = await tryDownloadDocumentBuffer(legacyPngPath);
      if (legacy) {
        image = legacy;
        contentType = "image/png";
      }
    } catch (err) {
      log.warn("thumbnail legacy png read failed", {
        documentId: doc.id,
        err: err instanceof Error ? { name: err.name, message: err.message } : { message: String(err) },
      });
    }
  }

  if (!image) {
    log.warn("thumbnail unavailable after generate attempt", { documentId: doc.id });
    marks.push({ name: "total", dur: performance.now() - t0 });
    return NextResponse.json(
      { error: "Não foi possível gerar a miniatura" },
      { status: 502, headers: serverTimingHeader(marks) },
    );
  }

  const etag = weakEtagForBuffer(image);
  const inm = req.headers.get("if-none-match");
  if (inm && inm === etag) {
    marks.push({ name: "total", dur: performance.now() - t0 });
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: etag,
        "Last-Modified": doc.updatedAt.toUTCString(),
        "Cache-Control": THUMB_CACHE_CONTROL,
        Vary: "Cookie",
        ...serverTimingHeader(marks),
      },
    });
  }

  marks.push({ name: "total", dur: performance.now() - t0 });
  return new NextResponse(new Uint8Array(image), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": THUMB_CACHE_CONTROL,
      ETag: etag,
      "Last-Modified": doc.updatedAt.toUTCString(),
      Vary: "Cookie",
      ...serverTimingHeader(marks),
    },
  });
}
