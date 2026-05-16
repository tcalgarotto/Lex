import { validateDocumentFileSignature, type DocumentSignatureKind } from "@/lib/documents/file-signature";

export type UploadBufferValidation =
  | { ok: true; canonicalMime: string; kind: DocumentSignatureKind }
  | { ok: false; message: string };

export function validateLegalDocumentUploadBuffer(
  buffer: Buffer,
  fileName: string,
  declaredMime: string,
): UploadBufferValidation {
  const result = validateDocumentFileSignature(buffer, fileName, declaredMime);
  if (!result.ok) {
    return { ok: false, message: result.reason };
  }
  return { ok: true, canonicalMime: result.canonicalMime, kind: result.kind };
}
