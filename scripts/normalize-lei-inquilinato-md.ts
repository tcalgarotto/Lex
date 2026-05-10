/**
 * Normaliza `codigos de leis/LEI DO INQUILINATO.md` (texto plano) para o mesmo
 * padrão semântico de `CONSTITUICAO.md`: `[ARTIGO]`, `[META]`, `[INCISO]`…
 *
 * Usa `scripts/lib/semantic-legal-md-normalize.ts` (extraído do fluxo da CF).
 *
 * Uso:
 *   npx tsx scripts/normalize-lei-inquilinato-md.ts
 *   npx tsx scripts/normalize-lei-inquilinato-md.ts --dry-run
 */
// @ts-nocheck
import path from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import {
  PROFILE_LEI_8245_INQUILINATO,
  isLooseLegalHeadingLine,
  normalizeSemanticLegalMd,
} from "./lib/semantic-legal-md-normalize";

const DEFAULT_IN = path.join("codigos de leis", "LEI DO INQUILINATO.md");

const APPENDIX_MARKER = "\n---\n\n## Apêndice:";

const DEFAULT_APPENDIX = `${APPENDIX_MARKER} manutenção do markdown

Padrão alinhado a \`codigos de leis/CONSTITUICAO.md\` (tags \`[ARTIGO]\`, \`[META]\`, \`[INCISO]\`, etc.).

**Renormalizar** (na raiz do repositório):

\`\`\`bash
npx tsx scripts/normalize-lei-inquilinato-md.ts
\`\`\`

Motor compartilhado: \`scripts/lib/semantic-legal-md-normalize.ts\` (perfil \`PROFILE_LEI_8245_INQUILINATO\`). Constituição Federal: \`scripts/normalize-constitucao-md.ts\` + \`PROFILE_CONSTITUICAO_FEDERAL\`.
`;

function stripAppendix(raw: string): string {
  const cut = raw.indexOf(APPENDIX_MARKER);
  if (cut === -1) return raw;
  return raw.slice(0, cut).trimEnd() + "\n";
}

function extractAppendix(raw: string): string {
  const cut = raw.indexOf(APPENDIX_MARKER);
  if (cut === -1) return DEFAULT_APPENDIX;
  return raw.slice(cut);
}

function auditLeiInquilinato(normalized: string): {
  artigosTotal: number;
  artigosSemMeta: number;
  headingsInvalidos: number;
  legalHeadingsSoltos: number;
  ok: boolean;
} {
  const lines = normalized.split("\n");
  let artigosTotal = 0;
  let artigosSemMeta = 0;
  let headingsInvalidos = 0;
  let legalHeadingsSoltos = 0;

  const allowedH1 = new Set(["# LEI_8245_INQUILINATO"]);
  const allowedH2Prefixes = [
    "## TITULO_",
    "## CAPITULO_",
    "## SECAO_",
    "## SUBSECAO_",
    "## LIVRO_",
    "## PARTE_",
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("# ")) {
      if (!allowedH1.has(line.trim())) headingsInvalidos++;
      continue;
    }
    if (line.startsWith("## ")) {
      const ok = allowedH2Prefixes.some((p) => line.startsWith(p));
      if (!ok) headingsInvalidos++;
      continue;
    }
    if (!line.startsWith("#") && !line.startsWith("[") && isLooseLegalHeadingLine(line)) {
      legalHeadingsSoltos++;
    }
    const art = line.match(/^\[ARTIGO:([0-9]+(?:-[A-Z])?)\]$/);
    if (art) {
      artigosTotal++;
      const next = lines[i + 1] ?? "";
      if (next.trim() !== "[META]") artigosSemMeta++;
    }
  }

  return {
    artigosTotal,
    artigosSemMeta,
    headingsInvalidos,
    legalHeadingsSoltos,
    ok: artigosSemMeta === 0 && headingsInvalidos === 0 && legalHeadingsSoltos === 0,
  };
}

async function main() {
  const dry = process.argv.includes("--dry-run");
  const inputPath = path.resolve(process.cwd(), DEFAULT_IN);

  const raw = await readFile(inputPath, "utf8");
  const appendix = extractAppendix(raw);
  const stripped = stripAppendix(raw);
  const normalized = normalizeSemanticLegalMd(stripped, PROFILE_LEI_8245_INQUILINATO);

  const report = auditLeiInquilinato(normalized);
  console.log(
    [
      "=== LEI 8.245/1991 (semântico) ===",
      `artigos_total=${report.artigosTotal}`,
      `artigos_sem_meta=${report.artigosSemMeta}`,
      `headings_invalidos=${report.headingsInvalidos}`,
      `legal_headings_soltos=${report.legalHeadingsSoltos}`,
      `status=${report.ok ? "ok" : "revisar"}`,
      "================================",
    ].join("\n"),
  );

  if (dry) {
    console.log("(dry-run: arquivo não escrito)");
    return;
  }

  const body = normalized.endsWith("\n") ? normalized : normalized + "\n";
  await writeFile(inputPath, body + appendix.replace(/^\n+/, ""), "utf8");
  console.log("Gravado:", inputPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
