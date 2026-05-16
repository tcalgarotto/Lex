import { getEnv } from "@/lib/env";

/**
 * Tipos declarados aceitos na primeira triagem (antes dos magic bytes).
 * `application/octet-stream` só é persistido se o conteúdo for PDF/DOCX/TXT válido.
 */
export const ALLOWED_DOCUMENT_UPLOAD_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "application/octet-stream",
]);

export function getMaxUploadFileSizeBytes(): number {
  return getEnv().DEFAULT_MAX_UPLOAD_FILE_SIZE_BYTES;
}
