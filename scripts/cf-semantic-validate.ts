/**
 * Diagnóstico do parser semântico contra o markdown real da CF.
 * Não escreve nada. Útil pra Phase 2 do reset:
 *
 *   npx tsx scripts/cf-semantic-validate.ts
 */
import "../src/lib/env-normalize";
import path from "node:path";
import fs from "node:fs/promises";
import {
  parseConstitutionSemantic,
  validateCfSemantic,
} from "../src/lib/corpus/providers/cf-semantic-parser";

const MD_PATH = path.resolve(process.cwd(), "codigos de leis", "CONSTITUICAO.md");

async function main(): Promise<void> {
  const md = await fs.readFile(MD_PATH, "utf-8");
  console.log(`Lendo ${MD_PATH} (${(md.length / 1024).toFixed(1)} KB)`);

  const report = validateCfSemantic(md);
  const parsed = parseConstitutionSemantic(md, { strict: false });

  console.log("");
  console.log("[Validação]");
  console.table({
    ok: report.ok,
    articlesMain: report.stats.articlesMain,
    articlesAdct: report.stats.articlesAdct,
    incisos: report.stats.incisos,
    paragrafos: report.stats.paragrafos,
    alineas: report.stats.alineas,
    documentNotes: report.stats.documentNotes,
    articlesWithoutMeta: report.articlesWithoutMeta,
    errors: report.errors.length,
    bytes: report.stats.bytes,
  });

  console.log("");
  console.log("[Gaps]");
  console.log(
    `  corpo principal: ${report.gapsMain.length === 0 ? "nenhum" : report.gapsMain.join(",")}`,
  );
  console.log(
    `  ADCT          : ${report.gapsAdct.length === 0 ? "nenhum" : report.gapsAdct.join(",")}`,
  );
  console.log("");
  console.log("[Duplicates]");
  console.log(`  corpo: ${report.duplicatesMain.join(",") || "nenhum"}`);
  console.log(`  adct : ${report.duplicatesAdct.join(",") || "nenhum"}`);

  if (report.errors.length > 0) {
    console.log("");
    console.log("[Erros não-fatais]");
    for (const e of report.errors.slice(0, 20)) {
      console.log(`  L${e.line}: ${e.message}`);
    }
  }

  // Sanity-check extra: artigos críticos do briefing.
  const sample = (n: string, segment: "MAIN" | "ADCT") =>
    parsed.segments[segment].find((a) => a.number === n);

  console.log("");
  console.log("[Sanity checks do briefing]");

  const checks: Array<{ ok: boolean; message: string }> = [];
  // (9) Art. 218/219/219-A/219-B em CIENCIA_TECNOLOGIA_INOVACAO.
  for (const n of ["218", "219", "219-A", "219-B"]) {
    const a = sample(n, "MAIN");
    const ok = !!a && /CIENCIA_TECNOLOGIA_INOVACAO/i.test(a.meta.hierarquia);
    checks.push({
      ok,
      message: `Art. ${n} (CF) em CIENCIA_TECNOLOGIA_INOVACAO: ${ok ? "ok" : "FALHA"} (hier=${a?.meta.hierarquia ?? "?"})`,
    });
  }
  // (10) Art. 235 — briefing diz "ADCT codigo=ADCT", mas CF tem Art. 235 em
  // TITULO_IX (corpo principal). Reportamos a divergência.
  const a235Main = sample("235", "MAIN");
  const a235Adct = sample("235", "ADCT");
  if (a235Adct) {
    checks.push({
      ok: a235Adct.meta.codigo === "ADCT",
      message: `Art. 235 ADCT existe e codigo=${a235Adct.meta.codigo}: ${a235Adct.meta.codigo === "ADCT" ? "ok" : "FALHA"}`,
    });
  } else if (a235Main) {
    checks.push({
      ok: true,
      message: `Art. 235 NÃO está no ADCT (correto: pertence ao corpo da CF, hierarquia=${a235Main.meta.hierarquia}). Briefing item 10 incorreto.`,
    });
  } else {
    checks.push({ ok: false, message: "Art. 235 não encontrado." });
  }

  for (const c of checks) console.log(`  [${c.ok ? "✓" : "✗"}] ${c.message}`);

  console.log("");
  console.log("[Amostra de artigo (Art. 5º)]");
  const a5 = sample("5", "MAIN");
  console.log(`  ref      : ${a5?.ref}`);
  console.log(`  fullPath : ${a5?.fullPath}`);
  console.log(`  meta.codigo: ${a5?.meta.codigo}`);
  console.log(`  meta.tema  : ${a5?.meta.tema}`);
  console.log(`  internals  : ${a5?.internals.length}`);
  console.log(`  text(160)  : ${a5?.text.replace(/\s+/g, " ").slice(0, 160)}…`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
