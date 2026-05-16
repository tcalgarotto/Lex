/**
 * Validação de conteúdo por assinatura (magic bytes) — não confiar em MIME/extensão do cliente.
 */

export type DocumentSignatureKind = "pdf" | "docx" | "txt";

export type DocumentFileSignatureResult =
  | { ok: true; kind: DocumentSignatureKind; canonicalMime: string }
  | { ok: false; reason: string };

const PDF_MAGIC = Buffer.from("%PDF-", "ascii");
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

const CANONICAL_MIME: Record<DocumentSignatureKind, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
};

const ALLOWED_DECLARED_MIMES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "application/octet-stream",
]);

const EXT_BY_KIND: Record<DocumentSignatureKind, string[]> = {
  pdf: [".pdf"],
  docx: [".docx"],
  txt: [".txt", ".text"],
};

export function isPdfBuffer(buf: Buffer): boolean {
  return buf.length >= PDF_MAGIC.length && buf.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC);
}

export function isDocxBuffer(buf: Buffer): boolean {
  if (!buf.subarray(0, 4).equals(ZIP_MAGIC)) return false;
  const hay = buf.toString("binary");
  return hay.includes("[Content_Types].xml") && hay.includes("word/document.xml");
}

export function isPlainTextBuffer(buf: Buffer, fileName: string): boolean {
  if (buf.length === 0) return false;
  const ext = fileNameExtension(fileName);
  if (ext && !EXT_BY_KIND.txt.includes(ext)) return false;
  const sample = buf.subarray(0, Math.min(buf.length, 8192));
  if (sample.includes(0)) return false;
  const text = sample.toString("utf8");
  if (text.includes("\uFFFD")) return false;
  const lower = text.trimStart().toLowerCase();
  if (lower.startsWith("<!doctype") || lower.startsWith("<html") || lower.startsWith("<?xml")) {
    return false;
  }
  if (lower.includes("<script")) return false;
  return true;
}

export function fileNameExtension(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() ?? fileName;
  const idx = base.lastIndexOf(".");
  if (idx <= 0) return "";
  return base.slice(idx).toLowerCase();
}

function detectKind(buf: Buffer, fileName: string): DocumentSignatureKind | null {
  if (isPdfBuffer(buf)) return "pdf";
  if (isDocxBuffer(buf)) return "docx";
  if (isPlainTextBuffer(buf, fileName)) return "txt";
  return null;
}

function extensionMatchesKind(ext: string, kind: DocumentSignatureKind): boolean {
  if (!ext) return true;
  return EXT_BY_KIND[kind].includes(ext);
}

/**
 * Valida upload jurídico. `application/octet-stream` só passa se magic bytes confirmarem tipo.
 */
export function validateDocumentFileSignature(
  buffer: Buffer,
  fileName: string,
  declaredMime: string,
): DocumentFileSignatureResult {
  if (buffer.length === 0) {
    return { ok: false, reason: "Arquivo vazio." };
  }

  const mime = (declaredMime || "application/octet-stream").trim().toLowerCase();
  if (!ALLOWED_DECLARED_MIMES.has(mime)) {
    return {
      ok: false,
      reason: `Tipo não suportado: ${declaredMime}. Aceitamos PDF, DOCX ou TXT.`,
    };
  }

  const kind = detectKind(buffer, fileName);
  if (!kind) {
    return {
      ok: false,
      reason: "Conteúdo não reconhecido. Envie PDF, DOCX ou TXT válido.",
    };
  }

  const ext = fileNameExtension(fileName);
  if (!extensionMatchesKind(ext, kind)) {
    return {
      ok: false,
      reason: `Extensão do arquivo não corresponde ao conteúdo (${kind}).`,
    };
  }

  if (mime !== "application/octet-stream") {
    const expected = CANONICAL_MIME[kind];
    if (mime !== expected) {
      return {
        ok: false,
        reason: `Tipo declarado (${declaredMime}) não corresponde ao conteúdo real.`,
      };
    }
  }

  return { ok: true, kind, canonicalMime: CANONICAL_MIME[kind] };
}
