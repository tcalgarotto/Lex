/**
 * Provider canônico da Constituição Federal de 1988 a partir do markdown
 * curado em `codigos de leis/CONSTITUICAO.md`.
 *
 * O markdown é a fonte primária preferida para a CF (vide briefing
 * "Markdown como fonte principal"): texto limpo, hierarquia preservada,
 * sem dependência de OCR/Planalto HTML.
 *
 * Pipeline (compatível com `upsertCorpusPayload` → `embedAndUpsertNormVersion`):
 *
 *   read MD → parseConstitutionMarkdown → CorpusPayload (CONSTITUTION,
 *   urn:lex:br:federal:constituicao:1988-10-05;1988, provider=MANUAL)
 *
 * Não escreve no DB nem no Qdrant — quem persiste é o caller (script ou
 * Inngest function).
 */

import path from "node:path";
import fs from "node:fs/promises";
import { CorpusProvider, NormKind } from "@prisma/client";
import type { CorpusCandidate, CorpusPayload } from "./types";
import { parseConstitutionMarkdown, type CfParsedLaw } from "./markdown-cf-parser";

/**
 * URN-LEX canônica da CF/1988. Casa com o catálogo
 * (`OFFICIAL_LAWS["CF1988"].urn`).
 */
export const CF_URN = "urn:lex:br:federal:constituicao:1988-10-05;1988";

/** Caminho default do markdown da CF, relativo à raiz do repo. */
export const DEFAULT_CF_MARKDOWN_PATH = path.resolve(
  process.cwd(),
  "codigos de leis",
  "CONSTITUICAO.md",
);

export const CF_PROVIDER: CorpusProvider = CorpusProvider.MANUAL;

/** Carrega + parseia o markdown da CF. */
export async function loadParsedConstitution(
  markdownPath: string = DEFAULT_CF_MARKDOWN_PATH,
): Promise<{ md: string; parsed: CfParsedLaw }> {
  const md = await fs.readFile(markdownPath, "utf-8");
  const parsed = parseConstitutionMarkdown(md);
  if (parsed.articles.length === 0) {
    throw new Error(
      `Parser da CF retornou 0 artigos para ${markdownPath}. Verifique o markdown.`,
    );
  }
  return { md, parsed };
}

/** Constrói o `CorpusCandidate` canônico da CF. */
export function buildCfCandidate(): CorpusCandidate {
  return {
    urn: CF_URN,
    kind: NormKind.CONSTITUTION,
    title: "Constituição da República Federativa do Brasil de 1988",
    identifier: "CF/1988",
    authority: "Assembleia Nacional Constituinte",
    publishedAt: new Date("1988-10-05"),
    effectiveAt: new Date("1988-10-05"),
    sourceUrl: "https://www.planalto.gov.br/ccivil_03/Constituicao/Constituicao.htm",
    sourceExternalId: "CF1988-MD",
    tags: ["constitucional", "constituição", "manual", "markdown:oficial"],
    language: "pt-BR",
  };
}

/**
 * Constrói o `CorpusPayload` da CF a partir do markdown parseado.
 * Cada artigo entra como um bloco separado (caput + paragraphs), separado
 * por blank-line para que o `legal-chunker-v2` segmente por artigo.
 */
export function buildCfCorpusPayload(parsed: CfParsedLaw, mdSource: string): CorpusPayload {
  const blocks = parsed.articles
    .filter((a) => !a.isRevoked || a.text.length > 80)
    .map((a) => a.text.trim())
    .filter((s) => s.length > 0);
  const rawText = blocks.join("\n\n");

  return {
    candidate: buildCfCandidate(),
    rawText,
    metadata: {
      source: "markdown",
      sourcePath: "codigos de leis/CONSTITUICAO.md",
      articleCount: parsed.articles.length,
      articlesMain: parsed.cfStats.articlesMain,
      articlesAdct: parsed.cfStats.articlesAdct,
      paragraphsTotal: parsed.cfStats.paragraphs,
      bytes: parsed.cfStats.bytes,
      mdLengthChars: mdSource.length,
      preamble: parsed.preamble?.slice(0, 500),
    },
  };
}
