/**
 * P0 — Case Brain pipeline (entrevista → dados → persistência).
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Documentos vinculados a caso: extração de texto sempre; indexação semântica
 * no acervo só com opt-in (`caseBrain.documentSemanticIndexDocIds`).
 * Ver: docs/CASE_BRAIN.md
 */
import { NonRetriableError } from "inngest";
import { randomUUID } from "node:crypto";
import { DocumentStatus, LegalLayer } from "@prisma/client";
import { inngest } from "@/lib/inngest/client";
import { prisma } from "@/lib/prisma";
import { getLogger } from "@/lib/logger";
import { downloadDocumentBuffer } from "@/lib/storage";
import { chunkLegalText } from "@/lib/parsers/legal-chunker";
import { embedTexts } from "@/lib/ai/embeddings";
import { getQdrantVectorStore } from "@/lib/retrieval/vector-store/qdrant-store";
import { sha256Hex } from "@/lib/util/content-hash";
import { fireLexJustosEventForCase } from "@/lib/justos/emit-for-case";

const log = getLogger("lex.inngest.ingest-document");

const BATCH = 16;

/** Valida tenant do evento Inngest vs documento carregado (anti-ingest cross-workspace). */
export function assertDocumentIngestTenant(
  doc: { workspaceId: string },
  eventWorkspaceId: string | undefined,
): void {
  const expected = eventWorkspaceId?.trim() ?? "";
  if (expected && doc.workspaceId !== expected) {
    throw new Error(
      "Documento não pertence ao workspace do evento (possível evento adulterado).",
    );
  }
}

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
    log.error("failed to persist FAILED status", {
      documentId,
      err: e instanceof Error ? { name: e.name, message: e.message } : { message: String(e) },
    });
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
    const eventWorkspaceId = event.data.workspaceId?.trim() ?? "";

    const doc = await step.run("load-document", async () => {
      const d = await prisma.document.findFirst({
        where: { id: documentId, deletedAt: null },
      });
      if (!d) throw new NonRetriableError("Documento não encontrado");
      try {
        assertDocumentIngestTenant(d, eventWorkspaceId);
      } catch (e) {
        throw new NonRetriableError(e instanceof Error ? e.message : String(e));
      }
      return d;
    });

    const ingestMode = await step.run("resolve-ingest-mode", async () => {
      const { caseDocumentAllowsSemanticIndex } = await import(
        "@/lib/cases/case-brain/document-semantic-index-policy"
      );
      if (!doc.caseId) return "full" as const;
      const allow = await caseDocumentAllowsSemanticIndex(doc.caseId, doc.id);
      return allow ? ("full" as const) : ("text-only" as const);
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

    if (ingestMode === "text-only") {
      if (!text.trim()) {
        throw await failDocument(doc.id, "Não foi possível ler texto útil deste arquivo.");
      }
      await step.run("finish-text-only-case-doc", () =>
        prisma.document.update({
          where: { id: doc.id },
          data: {
            status: DocumentStatus.INDEXED,
            indexedAt: new Date(),
            progress: 1,
            totalChunks: 0,
            processedChunks: 0,
            errorMessage: null,
          },
        }),
      );
      if (doc.caseId) {
        await step.sendEvent("trigger-case-brain-text-only", {
          name: "lex/case.brain",
          data: { caseId: doc.caseId, source: "document_text_ready" },
        });
      }
      return { ok: true, chunks: 0, mode: "text-only" as const };
    }

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
      fireLexJustosEventForCase({
        event: "lex.document.indexed",
        workspaceId: doc.workspaceId,
        caseId: doc.caseId,
        meta: { documentId: doc.id, originalName: doc.originalName },
      });
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
