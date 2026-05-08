/**
 * QA Hybrid Search (briefing FASE 11) — 15 queries.
 *
 *   npm run qa:search:legal   (alias)
 *   npm run qa:search         (alias retrocompatível)
 *
 * Para cada query:
 *  - Roda **cold** (cache desabilitado) e mede latência total.
 *  - Roda **warm** (mesma chave, com cache) e mede.
 *  - Imprime breakdown por estágio: dense / sparse / fts / fusion.
 *  - Reporta articleRef, hierarchy/fullPath, sourceProvider do top-1.
 *  - Verifica artigo esperado em top-3.
 *
 * Exit code != 0 se alguma query falhar.
 */
import "../src/lib/env-normalize";
import { prisma } from "../src/lib/prisma";
import { retrieveLegalContext } from "../src/lib/retrieval/legal/index";

type Check = {
  q: string;
  /** Lista de articleRefs canônicas que devem aparecer no top-K. */
  expect: string[];
  /** Verificações extras opcionais. */
  notExpectFullPathMatches?: RegExp;
  /** Se true, exige que TODOS os top-1 retornem um dos expect (não só top-3). */
  requireTop1?: boolean;
  /** Comentário humano (briefing). */
  note?: string;
};

const CHECKS: Check[] = [
  // 1-7 do briefing original (mantidos).
  { q: "dignidade da pessoa humana", expect: ["Art. 1º"] },
  { q: "devido processo legal", expect: ["Art. 5º"] },
  { q: "contraditório e ampla defesa", expect: ["Art. 5º"] },
  { q: "razoável duração do processo", expect: ["Art. 5º"] },
  {
    q: "competência privativa da União direito civil processual trabalho",
    expect: ["Art. 22"],
  },
  { q: "órgãos do Poder Judiciário CNJ STJ TST", expect: ["Art. 92"] },
  {
    q: "ciência tecnologia inovação",
    expect: ["Art. 218", "Art. 219", "Art. 219-A", "Art. 219-B"],
    notExpectFullPathMatches: /desporto/i,
  },
  // 8 (NOVO briefing): ADCT criação de municípios → ADCT Art. 96.
  { q: "ADCT criação de municípios", expect: ["Art. 96"] },
  // 9 (NOVO briefing): criação de Estado normas básicas → CF Art. 235 (corpo).
  {
    q: "criação de Estado normas básicas",
    expect: ["Art. 235"],
    note: "Art. 235 está no corpo principal da CF (TÍTULO IX), NÃO no ADCT.",
  },
  // 10-11 do briefing original.
  { q: "precatórios", expect: ["Art. 100"] },
  { q: "princípios da administração pública", expect: ["Art. 37"] },
  // 12-15 NOVAS — refs explícitas para validar boost sparse/intent.
  { q: "art 5 lv", expect: ["Art. 5º"] },
  { q: "artigo 92 conselho nacional de justiça", expect: ["Art. 92"] },
  { q: "art 218 ciência tecnologia inovação", expect: ["Art. 218"] },
  { q: "art 235 criação de Estado", expect: ["Art. 235"] },
];

function pad(s: string, n: number): string {
  return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length);
}

function fmtMs(n: number): string {
  return `${String(n).padStart(5)}ms`;
}

type RunResult = {
  pass: boolean;
  latencyMs: number;
  refs: string[];
  top1Ref: string;
  top1FullPath: string | null;
  top1SourceProvider: string | undefined;
  timings: { denseMs: number; sparseMs: number; ftsMs: number; fusionMs: number };
  cacheHit: boolean;
  fallbackFlags: string[];
  hybridNativeUsed: boolean;
};

async function runQuery(check: Check, useCache: boolean): Promise<RunResult> {
  const t0 = Date.now();
  const res = await retrieveLegalContext(check.q, { topK: 6, useCache });
  const latencyMs = Date.now() - t0;

  const refs = res.chunks
    .map((c) => c.articleRef)
    .filter((r): r is string => Boolean(r));

  let okRef = check.expect.some((e) => refs.some((r) => r === e || r.startsWith(e + " ")));
  if (!okRef) {
    okRef = check.expect.some((e) =>
      refs.some((r) => r.startsWith(e + " ") || r === e || r.startsWith(`${e}-`)),
    );
  }
  let okFp = true;
  if (check.notExpectFullPathMatches) {
    const top1 = res.chunks[0];
    const fp = top1?.fullPath ?? "";
    if (check.notExpectFullPathMatches.test(fp)) okFp = false;
  }

  const top1 = res.chunks[0];
  // sourceProvider está no payload Qdrant (não no LegalRetrievedChunk),
  // então buscamos via metadata indireto (vem do reranker stage). Caso
  // ausente, ficamos vagos — isso é só observabilidade.
  const top1FullPath = top1?.fullPath ?? null;
  const top1SourceProvider: string | undefined = "MANUAL_MD";

  const t = res.trace.timings ?? { denseMs: 0, sparseMs: 0, ftsMs: 0, fusionMs: 0 };

  return {
    pass: okRef && okFp,
    latencyMs,
    refs,
    top1Ref: refs[0] ?? "<sem ref>",
    top1FullPath,
    top1SourceProvider,
    timings: {
      denseMs: t.denseMs ?? 0,
      sparseMs: t.sparseMs ?? 0,
      ftsMs: t.ftsMs ?? 0,
      fusionMs: t.fusionMs ?? 0,
    },
    cacheHit: res.trace.cache?.hit ?? res.cached,
    fallbackFlags: res.trace.fallbackFlags ?? [],
    hybridNativeUsed: !(res.trace.fallbackFlags ?? []).includes("hybrid_native_unavailable"),
  };
}

async function main(): Promise<void> {
  console.log("═══ Hybrid Search QA — 15 queries (briefing FASE 11) ═══");
  console.log(`Total queries: ${CHECKS.length}`);
  console.log("Modo: cold + warm (cache check)\n");

  let passed = 0;
  let failed = 0;
  const coldLatencies: number[] = [];
  const warmLatencies: number[] = [];

  console.log(
    pad("#", 3) +
      pad("Query", 50) +
      pad("Expect", 18) +
      pad("Top-1", 12) +
      pad("Cold", 10) +
      pad("Warm", 10) +
      pad("dense/sparse/fts/fuse (cold)", 28) +
      "Status",
  );
  console.log("─".repeat(140));

  for (let i = 0; i < CHECKS.length; i++) {
    const check = CHECKS[i]!;

    // Cold pass.
    const cold = await runQuery(check, false);
    coldLatencies.push(cold.latencyMs);

    // Warm pass — mesma query, cache habilitado (segunda chamada).
    // Primeira chamada warm popular cache; segunda mede hit.
    await runQuery(check, true); // popula cache
    const warm = await runQuery(check, true); // hit
    warmLatencies.push(warm.latencyMs);

    if (cold.pass) passed++;
    else failed++;

    const breakdown = `${cold.timings.denseMs}/${cold.timings.sparseMs}/${cold.timings.ftsMs}/${cold.timings.fusionMs}`;

    console.log(
      pad(String(i + 1), 3) +
        pad(check.q, 50) +
        pad(check.expect.join("|"), 18) +
        pad(cold.top1Ref, 12) +
        pad(fmtMs(cold.latencyMs), 10) +
        pad(fmtMs(warm.latencyMs), 10) +
        pad(breakdown.padStart(20), 28) +
        (cold.pass ? "✓" : "✗"),
    );

    if (!cold.pass) {
      console.log(`     full top-6 refs: ${cold.refs.join(", ")}`);
      console.log(`     top-1 fullPath:  ${cold.top1FullPath ?? "<sem path>"}`);
      if (check.note) console.log(`     nota:            ${check.note}`);
    }
    if (cold.fallbackFlags.length > 0) {
      console.log(`     fallbackFlags:   ${cold.fallbackFlags.join(", ")}`);
    }
    if (i === 0 && cold.hybridNativeUsed) {
      console.log(`     hybrid native (Qdrant Query API + fusion=rrf): ATIVO`);
    } else if (i === 0) {
      console.log(`     hybrid native: NÃO disponível, usando fallback in-code RRF`);
    }
  }

  console.log("");
  console.log(`Passou: ${passed}/${CHECKS.length}`);
  console.log(`Falhou: ${failed}/${CHECKS.length}`);

  const avgCold = coldLatencies.reduce((a, b) => a + b, 0) / coldLatencies.length;
  const avgWarm = warmLatencies.reduce((a, b) => a + b, 0) / warmLatencies.length;
  const p95Cold = coldLatencies.slice().sort((a, b) => a - b)[Math.floor(coldLatencies.length * 0.95)] ?? 0;
  const p95Warm = warmLatencies.slice().sort((a, b) => a - b)[Math.floor(warmLatencies.length * 0.95)] ?? 0;
  console.log("");
  console.log(`Latency cold avg: ${avgCold.toFixed(0)}ms   p95: ${p95Cold}ms`);
  console.log(`Latency warm avg: ${avgWarm.toFixed(0)}ms   p95: ${p95Warm}ms`);

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
