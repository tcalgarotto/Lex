/**
 * Debug do retrieve para uma única query — imprime intent, candidatos e
 * scores em detalhe.
 */
import "../src/lib/env-normalize";
import { prisma } from "../src/lib/prisma";
import { retrieveLegalContext } from "../src/lib/retrieval/legal/index";

const QUERY = process.argv[2] ?? "órgãos do Poder Judiciário CNJ STJ TST";

async function main(): Promise<void> {
  console.log(`Q: ${QUERY}\n`);
  const res = await retrieveLegalContext(QUERY, { topK: 10 });
  console.log("intent:", JSON.stringify(res.intent, null, 2));
  console.log("");
  console.log("confidence:", res.confidence);
  console.log("groundingScore:", res.groundingScore);
  console.log("cached:", res.cached);
  console.log(`chunks: ${res.chunks.length}`);
  for (const [i, c] of res.chunks.entries()) {
    console.log("");
    console.log(`#${i + 1}  ${c.articleRef ?? "<no-ref>"}  norm=${c.norm.identifier ?? c.norm.urn}`);
    console.log(`     final=${c.scores.final.toFixed(3)} dense=${c.scores.dense?.toFixed(3) ?? "-"} bm25=${c.scores.bm25?.toFixed(3) ?? "-"} rerank=${c.scores.rerank?.toFixed(3) ?? "-"}`);
    console.log(`     fullPath: ${c.fullPath}`);
    console.log(`     text: ${(c.text ?? "").slice(0, 200).replace(/\n/g, " ")}…`);
  }
}

main().catch(console.error).finally(async () => {
  await prisma.$disconnect();
});
