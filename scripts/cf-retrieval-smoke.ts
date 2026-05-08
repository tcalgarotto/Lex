/**
 * Smoke test: dispara `retrieveLegalContext` em queries representativas da
 * Constituição Federal e imprime os top-K resultados (com trecho + score).
 *
 * Não escreve nada. Útil pra confirmar que o índice canônico está
 * acessível ponta-a-ponta após `corpus:ingest-cf`.
 */

import "../src/lib/env-normalize";
import { prisma } from "../src/lib/prisma";
import { retrieveLegalContext } from "../src/lib/retrieval/legal/index";

const QUERIES: Array<{ q: string; expect: string[] }> = [
  { q: "direitos fundamentais inviolabilidade da intimidade", expect: ["Art. 5"] },
  { q: "competência da União legislar sobre direito civil", expect: ["Art. 22"] },
  { q: "princípios da administração pública impessoalidade", expect: ["Art. 37"] },
  { q: "habeas corpus cláusula pétrea", expect: ["Art. 5"] },
  { q: "controle de constitucionalidade reserva de plenário", expect: ["Art. 97"] },
  { q: "regime de precatórios disposições transitórias", expect: ["Art. 78", "ADCT"] },
];

async function main(): Promise<void> {
  console.log("═══ CF retrieval smoke ═══");
  for (const { q, expect } of QUERIES) {
    const t0 = Date.now();
    const res = await retrieveLegalContext(q, { topK: 5 });
    const dt = Date.now() - t0;
    console.log("");
    console.log(`Q: ${q}`);
    console.log(
      `  intent=${res.intent.kind}  confidence=${res.confidence.label} (${res.confidence.score.toFixed(2)})  groundingScore=${res.groundingScore.toFixed(2)}  cached=${res.cached}  latency=${dt}ms`,
    );
    if (expect.length) console.log(`  expect: ${expect.join(", ")}`);
    res.chunks.slice(0, 3).forEach((c, i) => {
      console.log(
        `  [${i + 1}] final=${c.scores.final.toFixed(3)}  ${c.articleRef ?? "<no-ref>"}  ${c.norm.identifier ?? c.norm.urn}`,
      );
      console.log(`      ${(c.text ?? "").slice(0, 120)}…`);
    });
  }
  console.log("");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
