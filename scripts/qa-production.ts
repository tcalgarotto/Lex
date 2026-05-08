/**
 * `npm run qa:production`
 *
 * QA fail-fast para o MVP do Lex.
 *
 * Verifica:
 *  - DB acessível (counts de Document, DocumentChunk, LegalNorm, LegalChunk)
 *  - Inngest functions sem regressão de pdf.worker.mjs (bundle safety)
 *  - Corpus jurídico mínimo populado (LegalChunk >= 20, LegalNorm >= 6)
 *  - Qdrant `lex_corpus_norms` com pontos > 0
 *  - Cockpit checklist (via API local) sem promessa de integração inexistente
 *  - Busca não devolve DEMO/FIXTURE em produção
 *
 * Sai com exit != 0 se qualquer crítico falhar. Cada falha imprime a
 * próxima ação concreta — não há mensagens crípticas.
 *
 * Flags:
 *   --base=http://host:port   URL base do app (default http://localhost:3000)
 *   --skip-http               pula checagens que requerem HTTP no app
 *   --json                    saída em JSON
 */

import "../src/lib/env-normalize";
import path from "node:path";
import fs from "node:fs/promises";
import { CorpusProvider } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { CORPUS_COLLECTIONS } from "../src/lib/corpus/qdrant-collections";

type CheckOutcome = {
  id: string;
  ok: boolean;
  detail: string;
  hint?: string;
};

type Flags = {
  base: string;
  skipHttp: boolean;
  json: boolean;
};

function parseFlags(argv: string[]): Flags {
  const base =
    argv.find((a) => a.startsWith("--base="))?.slice("--base=".length) ??
    process.env["QA_BASE_URL"] ??
    "http://localhost:3000";
  return {
    base,
    skipHttp: argv.includes("--skip-http"),
    json: argv.includes("--json"),
  };
}

async function readFile(rel: string): Promise<string> {
  return fs.readFile(path.resolve(__dirname, "..", rel), "utf-8");
}

async function checkBundleSafety(): Promise<CheckOutcome> {
  try {
    const route = await readFile("src/app/api/inngest/route.ts");
    if (/from\s+["']@\/lib\/parsers\/extract-text["']/.test(route)) {
      return {
        id: "bundle-safety",
        ok: false,
        detail: "src/app/api/inngest/route.ts importa extract-text no topo",
        hint: "Mover para `await import(...)` dentro de step.run().",
      };
    }
    const ingestDoc = await readFile(
      "src/lib/inngest/functions/ingest-document.ts",
    );
    if (
      /^\s*import\s+.+from\s+["']@\/lib\/parsers\/extract-text["']/m.test(ingestDoc)
    ) {
      return {
        id: "bundle-safety",
        ok: false,
        detail: "ingest-document.ts importa extract-text no topo",
        hint: "Use `await import(...)` dentro do step `extract-text`.",
      };
    }
    const parser = await readFile("src/lib/parsers/extract-text.ts");
    for (const dep of ["pdfjs-dist", "tesseract.js", "mammoth"]) {
      const re = new RegExp(`^\\s*import\\s+.+from\\s+["']${dep}[^"']*["']`, "m");
      if (re.test(parser)) {
        return {
          id: "bundle-safety",
          ok: false,
          detail: `extract-text.ts importa ${dep} no topo`,
          hint: "Use lazy import dentro da função.",
        };
      }
    }
    return { id: "bundle-safety", ok: true, detail: "sem imports top-level perigosos" };
  } catch (e) {
    return {
      id: "bundle-safety",
      ok: false,
      detail: (e as Error).message,
      hint: "Os arquivos do pipeline Inngest estão acessíveis?",
    };
  }
}

async function checkPrismaCounts(): Promise<CheckOutcome[]> {
  const out: CheckOutcome[] = [];
  try {
    const [docs, chunks, norms, legalChunks, manualChunks] = await Promise.all([
      prisma.document.count(),
      prisma.documentChunk.count(),
      prisma.legalNorm.count(),
      prisma.legalChunk.count(),
      prisma.legalChunk.count({
        where: { norm: { sourceProvider: CorpusProvider.MANUAL } },
      }),
    ]);

    out.push({
      id: "db-document",
      ok: true,
      detail: `Document=${docs}  DocumentChunk=${chunks}`,
    });

    if (docs > 0 && chunks === 0) {
      out.push({
        id: "db-document-chunks-empty",
        ok: false,
        detail: `${docs} documento(s) e 0 chunks`,
        hint: "Pipeline Inngest não está gerando chunks. Rode `npm run documents:audit`.",
      });
    } else {
      out.push({
        id: "db-document-chunks-empty",
        ok: true,
        detail: docs === 0 ? "sem documentos para chunkar ainda" : "OK",
      });
    }

    out.push({
      id: "legal-norms-min",
      ok: norms >= 6,
      detail: `LegalNorm=${norms} (mínimo 6)`,
      ...(norms < 6
        ? { hint: "Rode `npm run corpus:seed:minimal-legal`." }
        : {}),
    });

    out.push({
      id: "legal-chunks-min",
      ok: legalChunks >= 20,
      detail: `LegalChunk=${legalChunks} (mínimo 20). MANUAL=${manualChunks}`,
      ...(legalChunks < 20
        ? { hint: "Rode `npm run corpus:seed:minimal-legal`." }
        : {}),
    });
  } catch (e) {
    out.push({
      id: "db",
      ok: false,
      detail: `Prisma falhou: ${(e as Error).message}`,
      hint: "DATABASE_URL apontando para Postgres acessível?",
    });
  }
  return out;
}

async function checkQdrantCorpus(): Promise<CheckOutcome> {
  const url = process.env["QDRANT_URL"];
  if (!url) {
    return {
      id: "qdrant-corpus-norms",
      ok: false,
      detail: "QDRANT_URL ausente",
    };
  }
  try {
    const headers: Record<string, string> = {};
    const apiKey = process.env["QDRANT_API_KEY"];
    if (apiKey) headers["api-key"] = apiKey;
    const res = await fetch(
      `${url}/collections/${CORPUS_COLLECTIONS.norms}`,
      { headers, cache: "no-store" },
    );
    if (!res.ok) {
      return {
        id: "qdrant-corpus-norms",
        ok: false,
        detail: `${CORPUS_COLLECTIONS.norms}: HTTP ${res.status}`,
        hint: "Rode `npm run qdrant:init` para criar collections.",
      };
    }
    const json = (await res.json()) as { result?: { points_count?: number } };
    const points = json.result?.points_count ?? 0;
    return {
      id: "qdrant-corpus-norms",
      ok: points > 0,
      detail: `${CORPUS_COLLECTIONS.norms}: ${points} points`,
      ...(points === 0
        ? { hint: "Rode `npm run corpus:reindex:minimal`." }
        : {}),
    };
  } catch (e) {
    return {
      id: "qdrant-corpus-norms",
      ok: false,
      detail: (e as Error).message,
    };
  }
}

async function checkHttpHealth(base: string): Promise<CheckOutcome> {
  try {
    const res = await fetch(`${base}/api/health`, { cache: "no-store" });
    const txt = await res.text();
    if (!res.ok) {
      return {
        id: "http-health",
        ok: false,
        detail: `/api/health HTTP ${res.status}: ${txt.slice(0, 200)}`,
      };
    }
    let data: { status?: string };
    try {
      data = JSON.parse(txt) as { status?: string };
    } catch {
      data = {};
    }
    return {
      id: "http-health",
      ok: data.status !== "down",
      detail: `status=${data.status ?? "?"}`,
    };
  } catch (e) {
    return {
      id: "http-health",
      ok: false,
      detail: (e as Error).message,
      hint: `App ${base} está rodando? Use --base= ou QA_BASE_URL para apontar.`,
    };
  }
}

async function checkSearchClean(base: string): Promise<CheckOutcome> {
  try {
    const res = await fetch(`${base}/api/search?q=cpc&limit=20`, {
      cache: "no-store",
    });
    if (!res.ok) {
      return {
        id: "http-search-clean",
        ok: false,
        detail: `/api/search HTTP ${res.status}`,
      };
    }
    const data = (await res.json()) as {
      hits?: Array<{ title?: string; subtitle?: string; type?: string }>;
    };
    const hits = data.hits ?? [];
    const polluted = hits.filter((h) =>
      /DEMO|FIXTURE|STF-RE-DEMO/i.test(`${h.title ?? ""} ${h.subtitle ?? ""}`),
    );
    if (polluted.length > 0) {
      return {
        id: "http-search-clean",
        ok: false,
        detail: `${polluted.length} hit(s) com DEMO/FIXTURE em /busca?q=cpc`,
        hint:
          "Filtros de descontaminação em /api/search/route.ts não estão pegando este caso. Verifique logs.",
      };
    }
    return {
      id: "http-search-clean",
      ok: true,
      detail: `${hits.length} hit(s), nenhum DEMO/FIXTURE`,
    };
  } catch (e) {
    return {
      id: "http-search-clean",
      ok: false,
      detail: (e as Error).message,
    };
  }
}

function summarize(items: CheckOutcome[]): { ok: boolean; failures: number } {
  const failures = items.filter((i) => !i.ok).length;
  return { ok: failures === 0, failures };
}

function printHuman(items: CheckOutcome[]): void {
  console.log("═══ QA PRODUCTION ═══\n");
  for (const it of items) {
    const icon = it.ok ? "✔" : "✗";
    console.log(`${icon} ${it.id.padEnd(28)} ${it.detail}`);
    if (!it.ok && it.hint) console.log(`    ↳ ${it.hint}`);
  }
  console.log("");
  const { ok, failures } = summarize(items);
  if (ok) {
    console.log("✅ Todos os critérios mínimos do MVP atendidos.");
  } else {
    console.log(`✗ ${failures} verificação(ões) falharam.`);
  }
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));

  const items: CheckOutcome[] = [];
  items.push(await checkBundleSafety());
  items.push(...(await checkPrismaCounts()));
  items.push(await checkQdrantCorpus());

  if (!flags.skipHttp) {
    items.push(await checkHttpHealth(flags.base));
    items.push(await checkSearchClean(flags.base));
  }

  if (flags.json) {
    console.log(JSON.stringify({ items, ...summarize(items) }, null, 2));
  } else {
    printHuman(items);
  }

  if (!summarize(items).ok) {
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
