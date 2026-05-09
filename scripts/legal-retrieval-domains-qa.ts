/**
 * QA de retrieval por domínios sentinela (P0 comercial).
 *
 * Uso:
 *   npm run qa:retrieval:domains
 *
 * Objetivos:
 * - Validar que o retrieval retorna fonte real (URN + trecho + explicação mínima).
 * - Evitar regressões de "base ausente virar fundamento inventado".
 * - Evitar ADCT dominar top-3 fora de contexto.
 *
 * Nota: este gate valida APENAS retrieval. Drafting/review têm gates próprios.
 *
 * Restrições (por design):
 * - Não depende de rede externa: roda com `disableVectorSearch=true` (BM25-only).
 * - Não deve ser flaky: sem embeddings/Qdrant/rerank.
 * - Deve ser rápido: 10 queries, topK pequeno, cache desligado.
 */

import "../src/lib/env-normalize";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../src/lib/prisma";
import { retrieveLegalContext } from "../src/lib/retrieval/legal";

type DomainSuite = {
  version: number;
  notes?: string;
  domains: Array<{
    id: string;
    label: string;
    queries: Array<{
      q: string;
      expectAnyArticleRefPrefix?: string[];
      allowAdctDominance?: boolean;
    }>;
  }>;
};

const FORBIDDEN_NORM_TITLES = [
  // Se não está no corpus indexado, não pode aparecer como NORMA recuperada.
  // Observação: o texto da CF pode mencionar siglas/leis; isso NÃO é violação.
  "código de processo civil",
  "código de defesa do consumidor",
  "estatuto da criança e do adolescente",
  "lei 12.016",
  "lei nº 12.016",
  "lei de diretrizes e bases",
];

function isAdctUrn(urn: string | null | undefined): boolean {
  if (!urn) return false;
  return urn.includes("!adct");
}

function hasForbiddenNormTitle(normTitle: string, identifier?: string | null): string | null {
  const low = `${normTitle} ${identifier ?? ""}`.toLowerCase();
  for (const bad of FORBIDDEN_NORM_TITLES) {
    if (low.includes(bad)) return bad;
  }
  return null;
}

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length);
}

/**
 * Lê o primeiro objeto JSON válido de um arquivo, tolerando lixo/concatenação
 * acidental após o fim (defesa contra flake de arquivo gerado/mesclado).
 */
function parseFirstJsonObject<T>(raw: string): T {
  const s = raw.trimStart();
  if (!s.startsWith("{")) throw new Error("Suite inválida: esperado '{' no início");

  let i = 0;
  let depth = 0;
  let inStr = false;
  let escape = false;

  for (; i < s.length; i++) {
    const ch = s[i]!;
    if (inStr) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === "\"") {
        inStr = false;
      }
      continue;
    }

    if (ch === "\"") {
      inStr = true;
      continue;
    }
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) {
        const head = s.slice(0, i + 1);
        return JSON.parse(head) as T;
      }
    }
  }
  throw new Error("Suite inválida: JSON não fecha '}'");
}

async function main(): Promise<void> {
  const suitePath = path.resolve(process.cwd(), "tests/qa/legal-retrieval-domains.json");
  const raw = fs.readFileSync(suitePath, "utf-8");
  const suite = parseFirstJsonObject<DomainSuite>(raw);

  console.log("═══ QA Retrieval por Domínios — P0 Comercial ═══");
  console.log(`Suite: ${suitePath}`);
  console.log(`Domains: ${suite.domains.length}\n`);
  console.log("Como rodar: npm run qa:retrieval:domains");
  console.log(
    "Falha significa: (a) fonte proibida apareceu como recuperada; (b) ADCT dominou top-3 fora de contexto; (c) top-3 sem URN/articleRef/trecho; (d) trace mínimo ausente.\n",
  );

  let failed = 0;
  let passed = 0;

  console.log(pad("Domínio", 22) + pad("Query", 48) + pad("Top-1", 16) + "Status");
  console.log("─".repeat(95));

  for (const domain of suite.domains) {
    for (const check of domain.queries) {
      const res = await retrieveLegalContext(check.q, {
        topK: 6,
        useCache: false,
        useRerank: false,
        useGraphExpansion: false,
        disableVectorSearch: true,
      });

      const top = res.chunks.slice(0, 3);
      const adctCount = top.filter((c) => isAdctUrn(c.norm.urn)).length;

      const errs: string[] = [];

      if (res.chunks.length === 0) {
        errs.push("sem resultados");
      } else {
        // Trace mínimo (flags/estágios) — usado por UI/auditoria.
        if (!res.trace?.traceId) errs.push("trace ausente");
        if (!res.trace?.stages?.length) errs.push("trace sem stages");
        if (!res.trace?.candidates) errs.push("trace sem candidates");
        if (!res.trace?.cache) errs.push("trace sem cache");
        if (!res.trace?.timings) errs.push("trace sem timings");
        const stageNames = (res.trace?.stages ?? []).map((s) => s.stage);
        if (!stageNames.includes("classify-intent")) errs.push("trace sem classify-intent");
        if (!stageNames.includes("fuse")) errs.push("trace sem fuse");

        // Fonte real mínima.
        for (const c of res.chunks.slice(0, 3)) {
          if (!c.norm.urn) errs.push("sem URN");
          if (!c.articleRef && !c.fullPath) errs.push("sem articleRef/fullPath");
          if (!c.text || c.text.trim().length < 40) errs.push("sem trecho");
          if (!c.explanation || c.explanation.trim().length < 10) errs.push("sem explicação");
          const bad = hasForbiddenNormTitle(c.norm.title, c.norm.identifier);
          if (bad) errs.push(`fonte proibida: ${bad}`);
        }

        // ADCT domination fora de contexto.
        if (!check.allowAdctDominance && adctCount >= 2) {
          errs.push("ADCT domina top-3 fora de contexto");
        }

        // Observação: o gate NÃO exige artigo específico por domínio; ele foca
        // em: fonte real + trace mínimo + anti-ADCT + anti-"base inventada".
      }

      const top1Ref = res.chunks[0]?.articleRef ?? "<sem ref>";
      const ok = errs.length === 0;
      console.log(
        pad(domain.id, 22) +
          pad(check.q, 48) +
          pad(top1Ref, 16) +
          (ok ? "✓" : "✗"),
      );
      if (!ok) {
        failed++;
        console.log(`  - erros: ${errs.join("; ")}`);
        console.log(
          `  - top-3: ${res.chunks
            .slice(0, 3)
            .map((c) => `${c.norm.urn} ${c.articleRef ?? ""}`.trim())
            .join(" | ")}`,
        );
        console.log(
          `  - trace: stages=${(res.trace?.stages ?? []).map((s) => s.stage).join(", ") || "<vazio>"}; flags=${(res.trace?.fallbackFlags ?? []).join(", ") || "<nenhuma>"}`,
        );
      } else {
        passed++;
      }
    }
  }

  console.log("");
  console.log(`Passou: ${passed}`);
  console.log(`Falhou: ${failed}`);

  process.exitCode = failed === 0 ? 0 : 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

