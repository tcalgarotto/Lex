import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { isThumbnailMostlyBlankPng } from "@/lib/documents/pdf-thumbnail-blank";

const execFileAsync = promisify(execFile);

let popplerProbe: boolean | null = null;

function popplerBinary(): string {
  return process.env["POPPLER_PDFTOCAIRO"]?.trim() || "pdftocairo";
}

function popplerDisabled(): boolean {
  return process.env["LEX_THUMBNAIL_POPPLER"] === "0";
}

async function pdftocairoAvailable(): Promise<boolean> {
  if (popplerDisabled()) return false;
  if (popplerProbe !== null) return popplerProbe;
  const bin = popplerBinary();
  try {
    await execFileAsync(bin, ["-v"], { timeout: 3000 });
    popplerProbe = true;
  } catch {
    popplerProbe = false;
  }
  return popplerProbe;
}

function toArrayBufferSlice(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

/**
 * Renderiza páginas com Poppler (Cairo). Melhor suporte a JP2/JBIG2 que o pdf.js
 * + Skia no servidor. Só devolve quando a miniatura **não** é heuristica de
 * “papel branco”; se todas forem brancas, devolve `null` para o caller tentar unpdf.
 */
export async function tryRenderPdfThumbnailPngWithPoppler(pdfBytes: Buffer): Promise<Buffer | null> {
  if (!(await pdftocairoAvailable())) return null;

  const tmp = os.tmpdir();
  const id = randomUUID();
  const inputPath = path.join(tmp, `lex-thumb-${id}.pdf`);
  const bin = popplerBinary();
  const maxPages = 10;

  try {
    await fs.writeFile(inputPath, pdfBytes, { mode: 0o600 });

    for (let page = 1; page <= maxPages; page++) {
      const outPrefix = path.join(tmp, `lex-thumb-${id}-p${page}`);
      const outPng = `${outPrefix}.png`;
      try {
        await execFileAsync(
          bin,
          [
            "-png",
            "-singlefile",
            "-f",
            String(page),
            "-l",
            String(page),
            "-scale-to",
            "720",
            inputPath,
            outPrefix,
          ],
          { timeout: 12_000, maxBuffer: 32 * 1024 * 1024 },
        );
      } catch {
        if (page === 1) return null;
        break;
      }

      let pngBuf: Buffer;
      try {
        pngBuf = await fs.readFile(outPng);
      } catch {
        await fs.unlink(outPng).catch(() => {});
        if (page === 1) return null;
        break;
      }
      await fs.unlink(outPng).catch(() => {});

      const blank = await isThumbnailMostlyBlankPng(toArrayBufferSlice(pngBuf));
      if (!blank) return pngBuf;
    }

    return null;
  } finally {
    await fs.unlink(inputPath).catch(() => {});
  }
}
