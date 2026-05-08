/**
 * Extração de texto de uploads (PDF, DOCX, TXT).
 *
 * Importante (Vercel/serverless):
 * - NENHUM import top-level de `pdfjs-dist`, `mammoth` ou `tesseract.js`.
 *   Em produção, `pdfjs-dist` tenta resolver `pdf.worker.mjs` via
 *   `import.meta.url`, gera o caminho `/var/task/.next/server/app/api/inngest/pdf.worker.mjs`
 *   e o bundle do Next falha com `Cannot find module ...`.
 * - Tudo que toca PDF/DOCX/OCR vive atrás de `await import(...)` dentro
 *   da função, executado dentro de um `step.run` do Inngest. Assim o
 *   módulo só é resolvido em runtime, e o tracer do Next consegue
 *   anexar o que precisa quando combinado com `serverExternalPackages`
 *   no `next.config.ts`.
 * - Para PDF usamos `unpdf` (wrapper serverless-first do pdfjs, sem
 *   worker e sem canvas). É a única forma confiável em Vercel.
 *
 * Erros tipados são lançados para que o pipeline Inngest possa
 * convertê-los em `NonRetriableError` com mensagem honesta sem ficar
 * em loop de retry.
 */

export type ExtractTextErrorCode =
  | "PDF_NO_TEXT"
  | "PDF_CORRUPT"
  | "DOCX_CORRUPT"
  | "UNSUPPORTED_TYPE"
  | "OCR_NOT_AVAILABLE"
  | "EMPTY_TEXT";

export class ExtractTextError extends Error {
  readonly code: ExtractTextErrorCode;
  readonly userMessage: string;

  constructor(code: ExtractTextErrorCode, userMessage: string, cause?: unknown) {
    super(userMessage);
    this.name = "ExtractTextError";
    this.code = code;
    this.userMessage = userMessage;
    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}

/**
 * Considera um texto "extraído com sucesso" se tiver pelo menos
 * alguma quantidade real de caracteres alfanuméricos. PDFs de imagem
 * costumam vir com muito espaço em branco e zero conteúdo útil.
 */
function hasMeaningfulText(s: string): boolean {
  const cleaned = s.replace(/\s+/g, " ").trim();
  if (cleaned.length < 40) return false;
  const alnum = cleaned.replace(/[^A-Za-zÀ-ÿ0-9]/g, "");
  return alnum.length >= 30;
}

export async function extractTextFromBuffer(params: {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}): Promise<string> {
  const mt = params.mimeType.toLowerCase();
  const fname = params.fileName.toLowerCase();

  if (mt.includes("pdf") || fname.endsWith(".pdf")) {
    return extractPdfText(params.buffer);
  }

  if (
    mt.includes("officedocument.wordprocessingml") ||
    mt === "application/msword" ||
    fname.endsWith(".docx") ||
    fname.endsWith(".doc")
  ) {
    return extractDocxText(params.buffer);
  }

  if (mt.startsWith("text/") || fname.endsWith(".txt") || fname.endsWith(".md")) {
    const t = params.buffer.toString("utf-8").trim();
    if (!hasMeaningfulText(t)) {
      throw new ExtractTextError("EMPTY_TEXT", "Arquivo de texto vazio ou ilegível.");
    }
    return t;
  }

  throw new ExtractTextError(
    "UNSUPPORTED_TYPE",
    `Tipo não suportado: ${params.mimeType || "desconhecido"}. Aceitamos PDF, DOCX e TXT.`,
  );
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  let extractText: typeof import("unpdf").extractText;
  let getDocumentProxy: typeof import("unpdf").getDocumentProxy;
  try {
    const unpdf = await import("unpdf");
    extractText = unpdf.extractText;
    getDocumentProxy = unpdf.getDocumentProxy;
  } catch (cause) {
    throw new ExtractTextError(
      "PDF_CORRUPT",
      "Não foi possível carregar o parser de PDF no servidor.",
      cause,
    );
  }

  const data = new Uint8Array(buffer);
  let text = "";
  try {
    const pdf = await getDocumentProxy(data);
    const result = await extractText(pdf, { mergePages: true });
    const raw: unknown = (result as { text?: unknown }).text;
    if (typeof raw === "string") {
      text = raw;
    } else if (Array.isArray(raw)) {
      text = (raw as unknown[]).map((s) => (typeof s === "string" ? s : "")).join("\n");
    }
  } catch (cause) {
    throw new ExtractTextError(
      "PDF_CORRUPT",
      "PDF corrompido ou ilegível. Tente reenviar o arquivo.",
      cause,
    );
  }

  const cleaned = text.replace(/\s+/g, " ").trim();
  if (hasMeaningfulText(cleaned)) {
    return cleaned;
  }

  // PDF imagem / escaneado: tentar OCR somente se explicitamente habilitado.
  // Em produção mantemos OCR_NOT_AVAILABLE como mensagem honesta — o
  // OCR sai como etapa futura, sem retry infinito.
  // Lemos process.env direto para evitar carregar todo o env schema
  // (que tem campos obrigatórios que não interessam pro parser).
  //
  // Em NODE_ENV=test o OCR fica forçadamente desligado: tesseract.js
  // carrega um Worker pesado que vaza unhandled errors entre arquivos
  // de teste e torna o resultado dependente do `.env` local. Quem
  // precisar testar o caminho de OCR deve mockar tesseract diretamente.
  const ocrProviderRaw = String(process.env["OCR_PROVIDER"] ?? "").toLowerCase();
  const isTestEnv = process.env["NODE_ENV"] === "test" || process.env["VITEST"] === "true";
  const ocrEnabled = ocrProviderRaw === "tesseract" && !isTestEnv;

  if (ocrEnabled) {
    try {
      return await runTesseractOcr(buffer);
    } catch (cause) {
      throw new ExtractTextError(
        "OCR_NOT_AVAILABLE",
        "PDF sem texto extraível e OCR falhou. OCR será etapa futura.",
        cause,
      );
    }
  }

  throw new ExtractTextError(
    "PDF_NO_TEXT",
    "PDF sem texto extraível (provavelmente escaneado/imagem). OCR será etapa futura.",
  );
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  let mammoth: typeof import("mammoth");
  try {
    mammoth = await import("mammoth");
  } catch (cause) {
    throw new ExtractTextError(
      "DOCX_CORRUPT",
      "Não foi possível carregar o parser de DOCX no servidor.",
      cause,
    );
  }

  try {
    const r = await mammoth.extractRawText({ buffer });
    const text = (r.value ?? "").trim();
    if (!hasMeaningfulText(text)) {
      throw new ExtractTextError("EMPTY_TEXT", "Documento DOCX vazio ou sem texto extraível.");
    }
    return text;
  } catch (cause) {
    if (cause instanceof ExtractTextError) throw cause;
    throw new ExtractTextError(
      "DOCX_CORRUPT",
      "DOCX corrompido ou ilegível. Tente reenviar o arquivo.",
      cause,
    );
  }
}

async function runTesseractOcr(buffer: Buffer): Promise<string> {
  // Lazy import — Tesseract.js carrega worker/wasm pesado e só deve ser
  // resolvido se OCR estiver explicitamente habilitado.
  const tesseractMod = await import("tesseract.js");
  const Tesseract = tesseractMod.default ?? tesseractMod;
  const recognize = (Tesseract as { recognize: (b: Buffer, lang: string, opts: { logger: () => void }) => Promise<{ data: { text: string } }> }).recognize;
  const result = await recognize(buffer, "por", { logger: () => undefined });
  const text = String(result.data.text ?? "").trim();
  if (!hasMeaningfulText(text)) {
    throw new ExtractTextError("OCR_NOT_AVAILABLE", "OCR não conseguiu extrair texto útil.");
  }
  return text;
}
