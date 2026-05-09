import { NonRetriableError } from "inngest";
import { randomUUID } from "node:crypto";
import { DocumentStatus, LegalLayer } from "@prisma/client";
import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";
import { downloadDocumentBuffer } from "@/lib/storage";
import { chunkLegalText } from "@/lib/parsers/legal-chunker";
import { embedTexts } from "@/lib/ai/embeddings";
import { getQdrantVectorStore } from "@/lib/retrieval/vector-store/qdrant-store";
import { sha256Hex } from "@/lib/util/content-hash";

const BATCH = 16;

/**
 * Marca o Document como FAILED com mensagem de usuário e devolve
 * um `NonRetriableError` para o Inngest parar o pipeline. Sem esse
 * tratamento, erros como "PDF escaneado sem texto" causariam retries
 * infinitos.
 */
async function failDocument(
  documentId: string,
  reason: string,
  cause?: unknown,
): Promise<NonRetriableError> {
  try {
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: DocumentStatus.FAILED,
        errorMessage: reason.slice(0, 500),
        progress: 1,
      },
    });
  } catch (e) {
    console.error("[ingest-document] failed to persist FAILED status", e);
  }
  const err = new NonRetriableError(reason);
  if (cause !== undefined) {
    (err as Error & { cause?: unknown }).cause = cause;
  }
  return err;
}

export const ingestDocument = inngest.createFunction(
  { id: "ingest-document", retries: 3 },
  { event: "lex/document.ingest" },
  async ({ event, step }) => {
    const documentId = event.data.documentId;

    const doc = await step.run("load-document", async () => {
      const d = await prisma.document.findUnique({ where: { id: documentId } });
      if (!d) throw new NonRetriableError("Documento não encontrado");
      return d;
    });

    await step.run("status-parsing", () =>
      prisma.document.update({
        where: { id: doc.id },
        data: { status: DocumentStatus.PARSING, errorMessage: null, progress: 0.05 },
      }),
    );

    // IMPORTANTE: lazy import dentro do step. NUNCA importar
    // `extract-text` no topo deste módulo — ele puxa pdfjs/mammoth/
    // tesseract para o bundle da rota /api/inngest e quebra a
    // function no Vercel com `Cannot find module .../pdf.worker.mjs`.
    let text: string;
    try {
      text = await step.run("extract-text", async () => {
        const { extractTextFromBuffer, ExtractTextError } = await import(
          "@/lib/parsers/extract-text"
        );
        const buf = await downloadDocumentBuffer(doc.storagePath);
        try {
          return await extractTextFromBuffer({
            buffer: buf,
            mimeType: doc.mimeType,
            fileName: doc.originalName,
          });
        } catch (err) {
          if (err instanceof ExtractTextError) {
            // Erros controlados: viram NonRetriableError para o
            // Inngest interromper o pipeline com mensagem honesta.
            throw new NonRetriableError(`${err.code}: ${err.userMessage}`);
          }
          throw err;
        }
      });
    } catch (err) {
      const reason =
        err instanceof Error
          ? err.message
          : "Falha ao extrair texto do documento.";
      throw await failDocument(doc.id, reason, err);
    }

    await step.run("persist-extracted", () =>
      prisma.document.update({
        where: { id: doc.id },
        data: {
          extractedText: text.slice(0, 250_000),
          extractedAt: new Date(),
          progress: 0.18,
        },
      }),
    );

    await step.run("status-chunking", () =>
      prisma.document.update({
        where: { id: doc.id },
        data: { status: DocumentStatus.CHUNKING, progress: 0.22 },
      }),
    );

    const chunks = chunkLegalText(text, 1600, 180);

    if (chunks.length === 0) {
      throw await failDocument(
        doc.id,
        "Nenhum texto chunkável extraído do arquivo (texto muito curto ou ilegível).",
      );
    }

    await step.run("reset-chunks", async () => {
      await prisma.documentChunk.deleteMany({ where: { documentId: doc.id } });
      const store = getQdrantVectorStore();
      // workspaceId é obrigatório: o filtro Qdrant precisa isolar o tenant
      // antes de deletar (defesa em profundidade contra colisão de id).
      await store.deleteByDocumentId(doc.id, doc.workspaceId);
    });

    await step.run("status-embedding", () =>
      prisma.document.update({
        where: { id: doc.id },
        data: { status: DocumentStatus.EMBEDDING, progress: 0.3, totalChunks: chunks.length, processedChunks: 0 },
      }),
    );

    const store = getQdrantVectorStore();
    const layer: LegalLayer = "user_documents";

    for (let i = 0; i < chunks.length; i += BATCH) {
      const slice = chunks.slice(i, i + BATCH);
      const texts = slice.map((c) => c.text);
      const vectors = await step.run(`embed-${i}`, () => embedTexts(texts));

      await step.run(`upsert-${i}`, async () => {
        const points = slice.map((c, j) => {
          const id = randomUUID();
          const contentHash = sha256Hex(c.text);
          return {
            id,
            vector: vectors[j]!,
            payload: {
              workspaceId: doc.workspaceId,
              layer,
              chunkText: c.text,
              section: c.section,
              contentHash,
              documentId: doc.id,
              processId: doc.processId ?? undefined,
              sourceCode: c.label,
            },
          };
        });
        await store.upsertPoints(points);
        await prisma.documentChunk.createMany({
          data: points.map((p, j) => ({
            documentId: doc.id,
            chunkIndex: i + j,
            text: slice[j]!.text,
            textPreview: slice[j]!.text.slice(0, 2000),
            section: slice[j]!.section,
            contentHash: p.payload.contentHash,
            qdrantPointId: p.id,
            tokenEstimate: Math.ceil(slice[j]!.text.length / 4),
          })),
        });
        const processed = Math.min(chunks.length, i + slice.length);
        const frac = processed / Math.max(1, chunks.length);
        await prisma.document.update({
          where: { id: doc.id },
          data: {
            processedChunks: processed,
            progress: 0.3 + frac * 0.65,
          },
        });
      });
    }

    await step.run("finish", () =>
      prisma.document.update({
        where: { id: doc.id },
        data: { status: DocumentStatus.INDEXED, indexedAt: new Date(), progress: 1, processedChunks: chunks.length },
      }),
    );

    // F2 + F4.5: documento indexado dentro de um caso => recomputa Brain
    // (incorpora trechos extraídos como evidência) e roda checagem de
    // consistência. Ambos eventos são idempotentes (cache + Levenshtein).
    if (doc.caseId) {
      await step.sendEvent("trigger-case-brain", {
        name: "lex/case.brain",
        data: { caseId: doc.caseId, source: "document_indexed" },
      });
      await step.sendEvent("trigger-consistency-check", {
        name: "lex/document.consistency-check",
        data: { documentId: doc.id, caseId: doc.caseId },
      });
    }

    return { ok: true, chunks: chunks.length };
  },
);
