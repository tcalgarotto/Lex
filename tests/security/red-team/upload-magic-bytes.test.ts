import { describe, it, expect } from "vitest";
import { documentStoragePath } from "@/lib/storage";
import {
  isPdfBuffer,
  isDocxBuffer,
  isPlainTextBuffer,
  validateDocumentFileSignature,
} from "@/lib/documents/file-signature";
import { buildMinimalDocxBuffer, MINIMAL_PDF_BUFFER } from "./upload-fixtures";

describe("upload magic bytes (file-signature)", () => {
  it("M1 PDF mínimo válido passa", () => {
    const r = validateDocumentFileSignature(MINIMAL_PDF_BUFFER, "doc.pdf", "application/pdf");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.kind).toBe("pdf");
      expect(r.canonicalMime).toBe("application/pdf");
    }
    expect(isPdfBuffer(MINIMAL_PDF_BUFFER)).toBe(true);
  });

  it("M2 .pdf com texto hello bloqueia", () => {
    const buf = Buffer.from("hello", "utf8");
    const r = validateDocumentFileSignature(buf, "fake.pdf", "application/pdf");
    expect(r.ok).toBe(false);
  });

  it("M3 MIME application/pdf com HTML bloqueia", () => {
    const buf = Buffer.from("<html><body>x</body></html>", "utf8");
    const r = validateDocumentFileSignature(buf, "x.pdf", "application/pdf");
    expect(r.ok).toBe(false);
  });

  it("M4 octet-stream com PDF válido passa com mime canônico", () => {
    const r = validateDocumentFileSignature(
      MINIMAL_PDF_BUFFER,
      "scan.pdf",
      "application/octet-stream",
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.canonicalMime).toBe("application/pdf");
  });

  it("M5 DOCX mínimo válido passa", () => {
    const docx = buildMinimalDocxBuffer();
    expect(isDocxBuffer(docx)).toBe(true);
    const r = validateDocumentFileSignature(
      docx,
      "peça.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.kind).toBe("docx");
  });

  it("M6 DOCX falso (ZIP sem word/document.xml) bloqueia", () => {
    const zipOnly = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);
    const r = validateDocumentFileSignature(
      zipOnly,
      "bad.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(r.ok).toBe(false);
  });

  it("M7 TXT válido passa", () => {
    const buf = Buffer.from("Relato fictício red-team.\n", "utf8");
    expect(isPlainTextBuffer(buf, "nota.txt")).toBe(true);
    const r = validateDocumentFileSignature(buf, "nota.txt", "text/plain");
    expect(r.ok).toBe(true);
  });

  it("M8 HTML disfarçado bloqueia", () => {
    const buf = Buffer.from("<script>alert(1)</script>", "utf8");
    const r = validateDocumentFileSignature(buf, "evil.txt", "text/plain");
    expect(r.ok).toBe(false);
  });

  it("M9 path ../evil.pdf sanitizado", () => {
    const p = documentStoragePath("ws", "doc", "../evil.pdf");
    expect(p).not.toContain("/../");
    expect(p).toBe("ws/doc/.._evil.pdf");
  });

  it("M10 application/msword bloqueado na triagem de MIME declarado", () => {
    const r = validateDocumentFileSignature(MINIMAL_PDF_BUFFER, "x.pdf", "application/x-msdownload");
    expect(r.ok).toBe(false);
  });
});
