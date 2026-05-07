/**
 * Smoke test do pipeline de retrieval jurídico contra o corpus real.
 * Não escreve nada; apenas executa retrieve + imprime trace.
 *
 * Uso: npm run retrieval:smoke -- "sua query aqui"
 */

import { retrieveLegalContext } from "@/lib/retrieval/legal";

async function main() {
  const query = process.argv.slice(2).join(" ").trim() ||
    "direito de arrependimento do consumidor cláusula abusiva";
  const t0 = Date.now();

  const result = await retrieveLegalContext(query, {
    topK: 5,
    useCache: false,
    useRerank: true,
    useGraphExpansion: true,
  });

  console.log("=".repeat(80));
  console.log("Query:", JSON.stringify(query));
  console.log("Rewrites:");
  for (const r of result.rewrittenQueries) console.log("  -", r);
  console.log("Intent:", JSON.stringify(result.intent.signals));
  console.log("Filtros aplicados:", JSON.stringify(result.filters, null, 2));
  console.log("Trace:");
  console.log("  candidates:", JSON.stringify(result.trace.candidates));
  console.log("  stages:");
  for (const s of result.trace.stages) {
    console.log(`    [${s.latencyMs}ms] ${s.stage}`, s.detail ? JSON.stringify(s.detail).slice(0, 120) : "");
  }
  console.log("Grounding:", result.groundingScore.toFixed(3), `(${result.confidence.label})`);
  console.log("=".repeat(80));
  console.log(`TOP ${result.chunks.length} chunks:`);
  result.chunks.forEach((c, i) => {
    console.log(`#${i + 1} ${c.norm.identifier ?? c.norm.title} ${c.fullPath ?? ""}`);
    console.log("   urn:", c.norm.urn);
    console.log("   provenance:", c.provenance.join(", "));
    console.log("   ", c.explanation);
    console.log("   text:", c.text.slice(0, 140).replace(/\n/g, " "), "...");
  });
  console.log("=".repeat(80));
  console.log(`TOTAL: ${Date.now() - t0}ms`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
