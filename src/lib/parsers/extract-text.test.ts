import { describe, it, expect } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";

import { extractTextFromBuffer, ExtractTextError } from "./extract-text";

describe("extractTextFromBuffer", () => {
  it("extrai TXT", async () => {
    const text = "O réu deverá indenizar a parte autora pelos danos materiais comprovados nos autos.";
    const out = await extractTextFromBuffer({
      buffer: Buffer.from(text, "utf-8"),
      mimeType: "text/plain",
      fileName: "peticao.txt",
    });
    expect(out).toContain("indenizar");
  });

  it("rejeita TXT vazio com EMPTY_TEXT", async () => {
    await expect(
      extractTextFromBuffer({
        buffer: Buffer.from("   \n\n   ", "utf-8"),
        mimeType: "text/plain",
        fileName: "vazio.txt",
      }),
    ).rejects.toMatchObject({ code: "EMPTY_TEXT" });
  });

  it("rejeita tipo não suportado com UNSUPPORTED_TYPE", async () => {
    await expect(
      extractTextFromBuffer({
        buffer: Buffer.from([0, 1, 2, 3]),
        mimeType: "image/png",
        fileName: "foto.png",
      }),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_TYPE" });
  });

  it("rejeita PDF corrompido com PDF_CORRUPT", async () => {
    await expect(
      extractTextFromBuffer({
        buffer: Buffer.from("isso não é um PDF de verdade"),
        mimeType: "application/pdf",
        fileName: "fake.pdf",
      }),
    ).rejects.toMatchObject({ code: "PDF_CORRUPT" });
  });

  it("rejeita PDF sem texto extraível com PDF_NO_TEXT", async () => {
    // PDF mínimo válido sem nenhum stream de texto. Foi gerado por
    // pdf-lib só com uma página em branco.
    const fixture = path.join(__dirname, "__fixtures__/blank.pdf");
    let buffer: Buffer | null = null;
    try {
      buffer = await fs.readFile(fixture);
    } catch {
      // Geração lazy pra não acoplar com filesystem em CI.
      const { PDFDocument } = await import("pdf-lib");
      const doc = await PDFDocument.create();
      doc.addPage();
      const bytes = await doc.save();
      buffer = Buffer.from(bytes);
    }

    await expect(
      extractTextFromBuffer({
        buffer,
        mimeType: "application/pdf",
        fileName: "blank.pdf",
      }),
    ).rejects.toMatchObject({ code: "PDF_NO_TEXT" });
  });

  it("ExtractTextError carrega code + userMessage", () => {
    const err = new ExtractTextError("PDF_NO_TEXT", "msg");
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe("PDF_NO_TEXT");
    expect(err.userMessage).toBe("msg");
  });
});
