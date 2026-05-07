import mammoth from "mammoth";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { getEnv } from "@/lib/env";
import Tesseract from "tesseract.js";

export async function extractTextFromBuffer(params: {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}): Promise<string> {
  const mt = params.mimeType.toLowerCase();

  if (mt.includes("pdf")) {
    return extractPdfText(params.buffer);
  }
  if (mt.includes("word") || params.fileName.toLowerCase().endsWith(".docx")) {
    const r = await mammoth.extractRawText({ buffer: params.buffer });
    return r.value.trim();
  }
  if (mt.startsWith("text/") || params.fileName.toLowerCase().endsWith(".txt")) {
    return params.buffer.toString("utf-8").trim();
  }

  if (getEnv().OCR_PROVIDER === "mistral" && getEnv().MISTRAL_API_KEY) {
    throw new Error("OCR Mistral não implementado nesta versão — use PDF texto ou DOCX.");
  }

  const worker = await Tesseract.recognize(params.buffer, "por", { logger: () => undefined });
  return String(worker.data.text ?? "").trim();
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const loadingTask = getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  });
  const pdf = await loadingTask.promise;
  let full = "";
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const strings = content.items.map((it) => ("str" in it ? it.str : "")).filter(Boolean);
    full += strings.join(" ") + "\n";
  }
  const t = full.replace(/\s+/g, " ").trim();
  if (t.length < 40) {
    const worker = await Tesseract.recognize(buffer, "por", { logger: () => undefined });
    return String(worker.data.text ?? "").trim();
  }
  return t;
}
