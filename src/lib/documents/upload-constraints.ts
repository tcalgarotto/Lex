import { getEnv } from "@/lib/env";

export const ALLOWED_DOCUMENT_UPLOAD_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "application/octet-stream",
]);

export function getMaxUploadFileSizeBytes(): number {
  return getEnv().DEFAULT_MAX_UPLOAD_FILE_SIZE_BYTES;
}
