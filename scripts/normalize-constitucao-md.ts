// @ts-nocheck
// Script one-shot que reformatou o `CONSTITUICAO.md` legado para o formato
// semântico ([ARTIGO:N] + [META]). A lógica compartilhada vive em
// `scripts/lib/semantic-legal-md-normalize.ts`.
import { readFile, writeFile } from "node:fs/promises";
import {
  PROFILE_CONSTITUICAO_FEDERAL,
  isLooseLegalHeadingLine,
  normalizeSemanticLegalMd,
} from "./lib/semantic-legal-md-normalize";

function auditNormalized(normalized: string): {
  artigosTotal: number;
  artigosSemMeta: number;
  headingsInvalidos: number;
  incisosCompostosQuebrados: number;
  paragrafosCompostosQuebrados: number;
  artigosCompostosQuebrados: number;
  incisosCompostosCorrigidos: number;
  paragrafosCompostosCorrigidos: number;
  adctSeparado: boolean;
  incisosDuplicadosNoMesmoArtigo: number;
  legalHeadingsSoltos: number;
  artigosHierarquiaIncompativel: number;
  artigos218_219_fora_de_ciencia: number;
  conteudoNaoNormativoNoFim: boolean;
  statusParseavel: boolean;
} {
  const lines = normalized.split("\n");

  let artigosTotal = 0;
  let artigosSemMeta = 0;
  let headingsInvalidos = 0;
  let incisosCompostosQuebrados = 0;
  let paragrafosCompostosQuebrados = 0;
  let artigosCompostosQuebrados = 0;
  let incisosCompostosCorrigidos = 0;
  let paragrafosCompostosCorrigidos = 0;
  let adctSeparado = false;
  let incisosDuplicadosNoMesmoArtigo = 0;
  let legalHeadingsSoltos = 0;
  let artigosHierarquiaIncompativel = 0;
  let artigos218_219_fora_de_ciencia = 0;
  let conteudoNaoNormativoNoFim = false;

  const allowedH1 = new Set(["# CONSTITUICAO_FEDERAL", "# ADCT"]);
  const allowedH2Prefixes = [
    "## TITULO_",
    "## CAPITULO_",
    "## SECAO_",
    "## SUBSECAO_",
    "## LIVRO_",
    "## PARTE_",
    "## ATO",
  ];
  let currentArticle: string | null = null;
  let incisosSeen = new Set<string>();

  const metaByArticle = new Map<string, { hierarquia?: string; codigo?: string }>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("# ")) {
      if (!allowedH1.has(line.trim())) headingsInvalidos++;
      if (line.trim() === "# ADCT") adctSeparado = true;
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
      currentArticle = art[1];
      incisosSeen = new Set();
      const next = lines[i + 1] ?? "";
      if (next.trim() !== "[META]") artigosSemMeta++;
      if (/^\d+[A-Z]$/.test(currentArticle)) artigosCompostosQuebrados++;

      if ((lines[i + 1] ?? "").trim() === "[META]") {
        const meta: Record<string, string> = {};
        for (let j = i + 2; j < Math.min(i + 50, lines.length); j++) {
          const l = lines[j].trim();
          if (l === "[/META]") break;
          const eq = l.indexOf("=");
          if (eq > 0) meta[l.slice(0, eq)] = l.slice(eq + 1);
        }
        metaByArticle.set(currentArticle, { hierarquia: meta.hierarquia, codigo: meta.codigo });
      }
      continue;
    }

    const inciso = line.match(/^\[INCISO:([IVXLCDM]+)(?:-([A-Z]))?\]$/);
    if (inciso && currentArticle) {
      const key = inciso[0];
      if (incisosSeen.has(key)) incisosDuplicadosNoMesmoArtigo++;
      incisosSeen.add(key);

      const next = lines[i + 1] ?? "";
      if (!inciso[2] && /^[A-Z]\s*-\s+/.test(next)) incisosCompostosQuebrados++;
      if (inciso[2]) incisosCompostosCorrigidos++;
      continue;
    }

    const par = line.match(/^\[PARAGRAFO:(\d+)(?:-([A-Z]))?\]$/);
    if (par) {
      const next = lines[i + 1] ?? "";
      if (!par[2] && /^-[A-Z]\.\s+/.test(next)) paragrafosCompostosQuebrados++;
      if (par[2]) paragrafosCompostosCorrigidos++;
      continue;
    }
  }

  for (const id of ["218", "219", "219-A"]) {
    const meta = metaByArticle.get(id);
    if (!meta?.hierarquia) {
      artigosHierarquiaIncompativel++;
      continue;
    }
    const h = meta.hierarquia;
    if (h.includes("DESPORTO")) artigos218_219_fora_de_ciencia++;
    if (!h.includes("CAPITULO_IV>CIENCIA_TECNOLOGIA_INOVACAO")) artigos218_219_fora_de_ciencia++;
  }

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "[DOCUMENT_NOTE]") {
      conteudoNaoNormativoNoFim = true;
      break;
    }
  }

  const statusParseavel =
    artigosSemMeta === 0 &&
    headingsInvalidos === 0 &&
    incisosCompostosQuebrados === 0 &&
    paragrafosCompostosQuebrados === 0 &&
    artigosCompostosQuebrados === 0 &&
    adctSeparado &&
    legalHeadingsSoltos === 0 &&
    artigos218_219_fora_de_ciencia === 0;

  return {
    artigosTotal,
    artigosSemMeta,
    headingsInvalidos,
    incisosCompostosQuebrados,
    paragrafosCompostosQuebrados,
    artigosCompostosQuebrados,
    incisosCompostosCorrigidos,
    paragrafosCompostosCorrigidos,
    adctSeparado,
    incisosDuplicadosNoMesmoArtigo,
    legalHeadingsSoltos,
    artigosHierarquiaIncompativel,
    artigos218_219_fora_de_ciencia,
    conteudoNaoNormativoNoFim,
    statusParseavel,
  };
}

async function main() {
  const targetPath = process.argv[2];
  if (!targetPath) {
    console.error("Usage: tsx scripts/normalize-constitucao-md.ts <path-to-md>");
    process.exit(2);
  }

  const original = await readFile(targetPath, "utf8");
  const normalized = normalizeSemanticLegalMd(original, PROFILE_CONSTITUICAO_FEDERAL);
  if (normalized === original) {
    console.log("No changes needed.");
    return;
  }

  await writeFile(targetPath, normalized, "utf8");
  console.log("Normalized:", targetPath);

  const report = auditNormalized(normalized);
  console.log(
    [
      "",
      "=== CONSTITUICAO.md INDEX AUDIT ===",
      `artigos_total=${report.artigosTotal}`,
      `artigos_sem_meta=${report.artigosSemMeta}`,
      `headings_invalidos=${report.headingsInvalidos}`,
      `legal_headings_soltos=${report.legalHeadingsSoltos}`,
      `artigos_hierarquia_incompativel=${report.artigosHierarquiaIncompativel}`,
      `artigos_218_219_219A_fora_de_ciencia=${report.artigos218_219_fora_de_ciencia}`,
      `incisos_compostos_corrigidos=${report.incisosCompostosCorrigidos}`,
      `paragrafos_compostos_corrigidos=${report.paragrafosCompostosCorrigidos}`,
      `incisos_compostos_quebrados=${report.incisosCompostosQuebrados}`,
      `paragrafos_compostos_quebrados=${report.paragrafosCompostosQuebrados}`,
      `artigos_compostos_quebrados=${report.artigosCompostosQuebrados}`,
      `incisos_duplicados_no_mesmo_artigo=${report.incisosDuplicadosNoMesmoArtigo}`,
      `adct_separado=${report.adctSeparado ? "true" : "false"}`,
      `document_note_no_fim=${report.conteudoNaoNormativoNoFim ? "true" : "false"}`,
      `status_final=${report.statusParseavel ? "parseavel" : "nao_parseavel"}`,
      "===============================",
      "",
    ].join("\n"),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
