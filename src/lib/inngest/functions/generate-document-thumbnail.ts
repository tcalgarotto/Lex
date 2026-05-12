import { inngest } from "@/lib/inngest/client";
import { ensurePdfThumbnailInStorage } from "@/lib/documents/document-thumbnail-persist";

/**
 * Gera e grava miniatura de PDF no Storage (fora do request HTTP).
 * Disparado por `lex/document.thumbnail` (upload, reprocess ou placeholder na biblioteca).
 */
export const generateDocumentThumbnailFn = inngest.createFunction(
  { id: "generate-document-thumbnail", retries: 2 },
  { event: "lex/document.thumbnail" },
  async ({ event }) => {
    const documentId = event.data.documentId;
    await ensurePdfThumbnailInStorage(documentId);
    return { ok: true, documentId };
  },
);
