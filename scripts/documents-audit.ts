/**
 * `npm run documents:audit`
 *
 * Diagnóstico do pipeline de upload/ingestão de documentos.
 * Não modifica nada. Imprime:
 *   - total de Document
 *   - total por DocumentStatus
 *   - total de DocumentChunk
 *   - últimos 20 documentos (status, tamanho, mimeType, chunks, errorMessage)
 *   - documentos sem chunks (potenciais falhas silenciosas)
 *   - documentos em FAILED com errorMessage
 *   - sanidade de bundle: confere se algo importa pdfjs/pdf.worker no topo
 *     da função Inngest (regressão do bug `Cannot find module .../pdf.worker.mjs`).
 *
 * Sai com exit 0 — é diagnóstico puro.
 */

import "../src/lib/env-normalize";
import path from "node:path";
import fs from "node:fs/promises";
import { prisma } from "../src/lib/prisma";
import { DocumentStatus } from "@prisma/client";

function fmt(d?: Date | null): string {
  return d ? d.toISOString().replace("T", " ").slice(0, 19) : "—";
}

function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

async function checkParserBundleSafety(): Promise<{ ok: boolean; warnings: string[] }> {
  const warnings: string[] = [];
  const root = path.resolve(__dirname, "..");
  const inngestRoute = path.join(root, "src/app/api/inngest/route.ts");
  const ingestDoc = path.join(root, "src/lib/inngest/functions/ingest-document.ts");

  try {
    const a = await fs.readFile(inngestRoute, "utf8");
    if (/from\s+["']@\/lib\/parsers\/extract-text["']/.test(a)) {
      warnings.push(
        "src/app/api/inngest/route.ts importa @/lib/parsers/extract-text no topo — REGRESSÃO. Mover para lazy import.",
      );
    }
  } catch {
    warnings.push("não foi possível ler src/app/api/inngest/route.ts");
  }

  try {
    const b = await fs.readFile(ingestDoc, "utf8");
    if (/^\s*import\s+.+from\s+["']@\/lib\/parsers\/extract-text["']/m.test(b)) {
      warnings.push(
        "src/lib/inngest/functions/ingest-document.ts importa extract-text no topo — REGRESSÃO. Use `await import()` dentro do step.",
      );
    }
  } catch {
    warnings.push("não foi possível ler src/lib/inngest/functions/ingest-document.ts");
  }

  try {
    const parser = await fs.readFile(path.join(root, "src/lib/parsers/extract-text.ts"), "utf8");
    if (/^\s*import\s+.*\s+from\s+["']pdfjs-dist[^"']*["']/m.test(parser)) {
      warnings.push(
        "src/lib/parsers/extract-text.ts importa pdfjs-dist no topo — REGRESSÃO. Use `await import('unpdf')` dentro da função.",
      );
    }
    if (/^\s*import\s+.*\s+from\s+["']tesseract\.js["']/m.test(parser)) {
      warnings.push(
        "src/lib/parsers/extract-text.ts importa tesseract.js no topo — REGRESSÃO. Use lazy import.",
      );
    }
    if (/^\s*import\s+.*\s+from\s+["']mammoth["']/m.test(parser)) {
      warnings.push(
        "src/lib/parsers/extract-text.ts importa mammoth no topo — REGRESSÃO. Use lazy import.",
      );
    }
  } catch {
    warnings.push("não foi possível ler src/lib/parsers/extract-text.ts");
  }

  return { ok: warnings.length === 0, warnings };
}

async function main(): Promise<void> {
  console.log("═══ DOCUMENTS AUDIT ═══\n");

  const safety = await checkParserBundleSafety();
  console.log("Bundle safety (Inngest /api/inngest):");
  if (safety.ok) {
    console.log("  ✔ nenhum import top-level perigoso (pdfjs / tesseract / mammoth / parsers)\n");
  } else {
    for (const w of safety.warnings) console.log(`  ✗ ${w}`);
    console.log("");
  }

  const [docTotal, chunkTotal] = await Promise.all([
    prisma.document.count(),
    prisma.documentChunk.count(),
  ]);

  const byStatus = await prisma.document.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  const statusMap: Partial<Record<DocumentStatus, number>> = Object.fromEntries(
    byStatus.map((r) => [r.status, r._count._all]),
  );

  console.log("Totais:");
  console.log(`  Document       : ${docTotal}`);
  console.log(`  DocumentChunk  : ${chunkTotal}`);
  console.log("");
  console.log("Document por status:");
  for (const s of Object.values(DocumentStatus)) {
    const n = statusMap[s] ?? 0;
    console.log(`  ${s.padEnd(9)} : ${n}`);
  }
  console.log("");

  const recent = await prisma.document.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      sizeBytes: true,
      status: true,
      progress: true,
      totalChunks: true,
      processedChunks: true,
      errorMessage: true,
      createdAt: true,
      indexedAt: true,
    },
  });

  console.log(`Últimos ${recent.length} documentos:`);
  if (recent.length === 0) {
    console.log("  (nenhum documento no banco)");
  } else {
    for (const d of recent) {
      const chunks =
        d.totalChunks != null && d.processedChunks != null
          ? `${d.processedChunks}/${d.totalChunks}`
          : "—";
      console.log(
        `  • ${fmt(d.createdAt)}  ${d.status.padEnd(9)}  ${chunks.padEnd(7)}  ${bytes(d.sizeBytes).padEnd(8)}  ${d.mimeType.slice(0, 35).padEnd(35)}  ${d.originalName.slice(0, 60)}`,
      );
      if (d.errorMessage) {
        console.log(`      ↳ erro: ${d.errorMessage.slice(0, 200)}`);
      }
    }
  }
  console.log("");

  // Documentos sem chunks (após CHUNKING/EMBEDDING/INDEXED)
  const indexedCandidates = await prisma.document.findMany({
    where: {
      status: { in: [DocumentStatus.INDEXED, DocumentStatus.EMBEDDING, DocumentStatus.CHUNKING] },
    },
    select: { id: true, originalName: true, status: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const noChunks: Array<{ id: string; originalName: string; status: DocumentStatus; createdAt: Date }> = [];
  for (const d of indexedCandidates) {
    const c = await prisma.documentChunk.count({ where: { documentId: d.id } });
    if (c === 0) noChunks.push(d);
  }

  console.log(`Documentos com status >= CHUNKING mas sem nenhum chunk no banco: ${noChunks.length}`);
  for (const d of noChunks.slice(0, 10)) {
    console.log(`  • ${fmt(d.createdAt)}  ${d.status.padEnd(9)}  ${d.id}  ${d.originalName.slice(0, 60)}`);
  }
  console.log("");

  const failed = await prisma.document.findMany({
    where: { status: DocumentStatus.FAILED },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      errorMessage: true,
      createdAt: true,
    },
  });

  console.log(`Últimos ${failed.length} FAILED:`);
  if (failed.length === 0) {
    console.log("  (nenhum)");
  } else {
    for (const d of failed) {
      console.log(
        `  • ${fmt(d.createdAt)}  ${d.id}  ${d.mimeType.padEnd(35).slice(0, 35)}  ${d.originalName.slice(0, 50)}`,
      );
      console.log(`      ↳ ${d.errorMessage ?? "(sem mensagem)"}`);
    }
  }

  console.log("\n═══ FIM ═══");
}

main()
  .catch((e) => {
    console.error("\nFalha no audit:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
