/**
 * Provider canônico da Constituição Federal de 1988 a partir do markdown
 * semântico curado em `codigos de leis/CONSTITUICAO.md` (formato
 * `[ARTIGO:N]` + `[META]...[/META]` + `[INCISO|PARAGRAFO|ALINEA]`).
 *
 * Pipeline: read MD → `parseConstitutionSemantic` → `CorpusPayload`
 * (CONSTITUTION, urn:lex:br:federal:constituicao:1988-10-05;1988,
 * provider=MANUAL).
 *
 * Não escreve no DB nem no Qdrant — quem persiste é o caller (script ou
 * Inngest function).
 */

import path from "node:path";
import fs from "node:fs/promises";
import { CorpusProvider, NormKind } from "@prisma/client";
import type { CorpusCandidate, CorpusPayload } from "./types";
import {
  parseConstitutionSemantic,
  validateCfSemantic,
  type ParsedCfSemantic,
  type ParsedSemanticArticle,
} from "./cf-semantic-parser";

/**
 * URN-LEX canônica do **corpo principal** da CF/1988 (Arts. 1º..250).
 */
export const CF_URN = "urn:lex:br:federal:constituicao:1988-10-05;1988";

/**
 * URN-LEX do ADCT — Ato das Disposições Constitucionais Transitórias.
 * Modelado como **norma irmã** da CF para evitar colisão de `articleRef`
 * (Art. 1º existe em CF e em ADCT). Briefing FASE 3 (item 2) prevê.
 */
export const CF_ADCT_URN =
  "urn:lex:br:federal:constituicao:1988-10-05;1988!adct";

export const DEFAULT_CF_MARKDOWN_PATH = path.resolve(
  process.cwd(),
  "codigos de leis",
  "CONSTITUICAO.md",
);

export const CF_PROVIDER: CorpusProvider = CorpusProvider.MANUAL;

/**
 * Tag usada em `LegalChunk.metadataJson.sourceProvider` (auditoria do
 * pipeline). Diferencia "MANUAL" (genérico) de "MANUAL_MD" (markdown
 * semântico curado), conforme briefing FASE 3/5.
 */
export const CF_SOURCE_PROVIDER_TAG = "MANUAL_MD";

export async function loadParsedConstitution(
  markdownPath: string = DEFAULT_CF_MARKDOWN_PATH,
): Promise<{ md: string; parsed: ParsedCfSemantic }> {
  const md = await fs.readFile(markdownPath, "utf-8");
  const parsed = parseConstitutionSemantic(md, { strict: true });
  if (parsed.articles.length === 0) {
    throw new Error(
      `Parser semântico da CF retornou 0 artigos para ${markdownPath}.`,
    );
  }
  return { md, parsed };
}

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
    sourceExternalId: "CF1988-MD-SEMANTIC",
    tags: ["constitucional", "constituição", "manual_md", "markdown:semantico"],
    language: "pt-BR",
  };
}

export function buildAdctCandidate(): CorpusCandidate {
  return {
    urn: CF_ADCT_URN,
    kind: NormKind.CONSTITUTION,
    title: "Ato das Disposições Constitucionais Transitórias (ADCT)",
    identifier: "ADCT/CF/1988",
    authority: "Assembleia Nacional Constituinte",
    publishedAt: new Date("1988-10-05"),
    effectiveAt: new Date("1988-10-05"),
    sourceUrl: "https://www.planalto.gov.br/ccivil_03/Constituicao/Constituicao.htm",
    sourceExternalId: "CF1988-ADCT-MD-SEMANTIC",
    tags: ["constitucional", "adct", "manual_md", "markdown:semantico"],
    language: "pt-BR",
  };
}

type CfSegmentPayloadMeta = {
  segment: "MAIN" | "ADCT";
  source: "markdown-semantic";
  sourceProvider: typeof CF_SOURCE_PROVIDER_TAG;
  sourcePath: string;
  articleCount: number;
  incisos: number;
  paragrafos: number;
  alineas: number;
  bytes: number;
  themes: Array<{ tema: string; count: number }>;
  articles: Array<{
    number: string;
    ref: string;
    segment: "MAIN" | "ADCT";
    codigo: string;
    tipo: string;
    hierarquia: string;
    tema: string;
    vigencia: string;
    fullPath: string;
    internalsCount: number;
  }>;
};

function buildSegmentPayload(
  segment: "MAIN" | "ADCT",
  articles: ParsedSemanticArticle[],
  candidate: CorpusCandidate,
): CorpusPayload {
  const blocks = articles.map((a) => a.text.trim()).filter((s) => s.length > 0);
  const rawText = blocks.join("\n\n");
  const themeBuckets = new Map<string, number>();
  let incisos = 0;
  let paragrafos = 0;
  let alineas = 0;
  for (const a of articles) {
    themeBuckets.set(a.meta.tema, (themeBuckets.get(a.meta.tema) ?? 0) + 1);
    for (const inner of a.internals) {
      if (inner.kind === "INCISO") incisos++;
      else if (inner.kind === "PARAGRAFO") paragrafos++;
      else alineas++;
    }
  }
  const meta: CfSegmentPayloadMeta = {
    segment,
    source: "markdown-semantic",
    sourceProvider: CF_SOURCE_PROVIDER_TAG,
    sourcePath: "codigos de leis/CONSTITUICAO.md",
    articleCount: articles.length,
    incisos,
    paragrafos,
    alineas,
    bytes: Buffer.byteLength(rawText, "utf8"),
    themes: [...themeBuckets.entries()].map(([tema, count]) => ({ tema, count })),
    articles: articles.map((a) => ({
      number: a.number,
      ref: a.ref,
      segment: a.segment,
      codigo: a.meta.codigo,
      tipo: a.meta.tipo,
      hierarquia: a.meta.hierarquia,
      tema: a.meta.tema,
      vigencia: a.meta.vigencia,
      fullPath: a.fullPath,
      internalsCount: a.internals.length,
    })),
  };
  return { candidate, rawText, metadata: meta as unknown as Record<string, unknown> };
}

/**
 * Constrói os payloads canônicos da CF a partir do markdown parseado.
 * Retorna **dois** payloads (corpo principal + ADCT) — modelados como
 * normas irmãs (URN distinta) para evitar colisão de `articleRef` (Art. 1º
 * existe em ambos). Cada artigo vira um bloco separado por blank-line;
 * o `legal-chunker-v2` segmenta por bloco a partir daí.
 */
export function buildCfCorpusPayloads(
  parsed: ParsedCfSemantic,
  _mdSource: string,
): { main: CorpusPayload; adct: CorpusPayload } {
  return {
    main: buildSegmentPayload("MAIN", parsed.segments.MAIN, buildCfCandidate()),
    adct: buildSegmentPayload("ADCT", parsed.segments.ADCT, buildAdctCandidate()),
  };
}

/**
 * @deprecated use `buildCfCorpusPayloads` (modela CF e ADCT como normas
 * irmãs). Mantido apenas para compat retroativa em testes legados — em
 * produção sempre usar a versão dual.
 */
export function buildCfCorpusPayload(
  parsed: ParsedCfSemantic,
  mdSource: string,
): CorpusPayload {
  return buildCfCorpusPayloads(parsed, mdSource).main;
}

/** Alias público para validação leve (usada pelo script `corpus:validate`). */
export { validateCfSemantic };
