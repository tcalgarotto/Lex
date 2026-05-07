/**
 * Chunker jurídico v2 — preserva hierarquia brasileira (Parte, Livro, Título,
 * Capítulo, Seção, Subseção, Art., §, inciso, alínea, item) e produz chunks
 * com lineage estruturado para o `LegalChunk`.
 *
 * Garantias:
 *  - Cada chunk tem `structure` tipada (LegalStructure) e `fullPath` legível.
 *  - Artigos NUNCA são quebrados ao meio salvo se exceder `maxChars`.
 *  - Parágrafos/incisos/alíneas são agrupados sob seu artigo-pai por padrão.
 *  - Texto cru sem hierarquia detectável vira chunks `GENERIC` por window.
 *  - Output é estável e idempotente (a mesma entrada produz a mesma saída).
 */

import type { LegalStructure } from "@prisma/client";
import { normalizeLegalText } from "./normalize";

export type LegalChunkV2 = {
  /** Posição estável no documento (0..N). */
  ordinal: number;
  structure: LegalStructure;
  fullPath?: string;
  articleRef?: string;
  paragraphRef?: string;
  incisoRef?: string;
  alineaRef?: string;
  text: string;
};

export const CHUNKER_VERSION = "v2";

/** Versão mínima de chars por chunk (evita esmagar artigos pequenos demais). */
const DEFAULT_MIN = 200;

type DetectedHeader = {
  structure: LegalStructure;
  label: string;
  ref?: string;
};

const STRUCT_RE = {
  parte: /^PARTE\s+([IVXLCDM]+|[\dº°]+|[A-ZÁÉÍÓÚ\s]+)$/i,
  livro: /^LIVRO\s+([IVXLCDM]+|[\dº°]+)/i,
  titulo: /^T[ÍI]TULO\s+([IVXLCDM]+|[\dº°]+)/i,
  capitulo: /^CAP[ÍI]TULO\s+([IVXLCDM]+|[\dº°]+)/i,
  secao: /^SEÇÃO\s+([IVXLCDM]+|[\dº°]+)/i,
  subsecao: /^SUBSEÇÃO\s+([IVXLCDM]+|[\dº°]+)/i,
  artigo: /^Art\.\s*(\d+(?:[º°-]\w*)?)/,
};

function detectHeader(line: string): DetectedHeader | null {
  const t = line.trim();
  if (!t) return null;

  // Artigo: aceitamos linhas longas porque "Art. N. <conteúdo>" é o caso comum.
  let m = STRUCT_RE.artigo.exec(t);
  if (m) return { structure: "ARTIGO", label: t, ref: `Art. ${m[1]}` };

  // Demais headers: só linhas relativamente curtas (são cabeçalhos isolados).
  if (t.length > 200) return null;
  m = STRUCT_RE.subsecao.exec(t);
  if (m) return { structure: "SUBSECAO", label: t, ref: m[1] };
  m = STRUCT_RE.secao.exec(t);
  if (m) return { structure: "SECAO", label: t, ref: m[1] };
  m = STRUCT_RE.capitulo.exec(t);
  if (m) return { structure: "CAPITULO", label: t, ref: m[1] };
  m = STRUCT_RE.titulo.exec(t);
  if (m) return { structure: "TITULO", label: t, ref: m[1] };
  m = STRUCT_RE.livro.exec(t);
  if (m) return { structure: "LIVRO", label: t, ref: m[1] };
  m = STRUCT_RE.parte.exec(t);
  if (m) return { structure: "PARTE", label: t, ref: m[1] };
  return null;
}

type Crumb = { structure: LegalStructure; label: string; ref?: string };

/** Atualiza a "trilha" hierárquica quando encontramos um novo header. */
function updateBreadcrumb(
  crumbs: Crumb[],
  header: DetectedHeader,
): Crumb[] {
  const order: LegalStructure[] = [
    "PARTE",
    "LIVRO",
    "TITULO",
    "CAPITULO",
    "SECAO",
    "SUBSECAO",
    "ARTIGO",
  ];
  const idx = order.indexOf(header.structure);
  if (idx < 0) return [...crumbs, { ...header }];
  const kept = crumbs.filter(
    (c) => order.indexOf(c.structure) >= 0 && order.indexOf(c.structure) < idx,
  );
  return [...kept, { ...header }];
}

function fullPathFromCrumbs(crumbs: Crumb[]): string | undefined {
  if (crumbs.length === 0) return undefined;
  const parts = crumbs
    .map((c) => {
      if (c.structure === "ARTIGO") return c.ref ?? c.label;
      const human: Record<LegalStructure, string> = {
        PARTE: "Parte",
        LIVRO: "Livro",
        TITULO: "Título",
        CAPITULO: "Capítulo",
        SECAO: "Seção",
        SUBSECAO: "Subseção",
        ARTIGO: "Art.",
        CAPUT: "caput",
        PARAGRAFO: "§",
        INCISO: "inciso",
        ALINEA: "alínea",
        ITEM: "item",
        ANEXO: "Anexo",
        EMENTA: "Ementa",
        PREAMBULO: "Preâmbulo",
        NOTE: "Nota",
        GENERIC: "",
      };
      return c.ref ? `${human[c.structure]} ${c.ref}`.trim() : c.label;
    })
    .filter(Boolean);
  return parts.join(" › ");
}

/** Quebra texto longo respeitando parágrafos. */
function windowSplit(text: string, maxChars: number, overlap: number): string[] {
  if (text.length <= maxChars) return [text];
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(text.length, i + maxChars);
    let slice = text.slice(i, end);
    if (end < text.length) {
      const paragraphBreak = slice.lastIndexOf("\n\n");
      if (paragraphBreak > maxChars * 0.5) slice = slice.slice(0, paragraphBreak);
      else {
        const lineBreak = slice.lastIndexOf("\n");
        if (lineBreak > maxChars * 0.5) slice = slice.slice(0, lineBreak);
      }
    }
    out.push(slice.trim());
    i += Math.max(1, slice.length - overlap);
  }
  return out;
}

type ArticleAccumulator = {
  ordinal: number;
  articleRef?: string;
  paragraphRef?: string;
  incisoRef?: string;
  alineaRef?: string;
  buffer: string[];
};

/** Detecta marcadores intra-artigo (§ Nº, inciso romano, alínea letra). */
function detectIntraArticle(line: string): {
  paragraphRef?: string;
  incisoRef?: string;
  alineaRef?: string;
} | null {
  const t = line.trim();
  // Parágrafo único — pode aparecer literal: "Parágrafo único. ..."
  if (/^Parágrafo\s+único\b/i.test(t)) return { paragraphRef: "único" };
  const pa = /^§\s*(\d+|único)/i.exec(t);
  if (pa) return { paragraphRef: pa[1] === "único" ? "único" : `§ ${pa[1]}` };
  const inc = /^([IVXLCDM]+)\s*[—\-–]/.exec(t);
  if (inc) return { incisoRef: inc[1] };
  const al = /^([a-z])\)\s+/i.exec(t);
  if (al) return { alineaRef: al[1] };
  return null;
}

/**
 * Chunker principal. Saída sempre tipada e ordenada.
 */
export function chunkLegalNorm(
  rawText: string,
  options: { maxChars?: number; overlap?: number; minChars?: number } = {},
): LegalChunkV2[] {
  const maxChars = options.maxChars ?? 1800;
  const overlap = options.overlap ?? 180;
  const minChars = options.minChars ?? DEFAULT_MIN;

  const text = normalizeLegalText(rawText);
  if (!text) return [];

  const lines = text.split("\n");
  const chunks: LegalChunkV2[] = [];
  let crumbs: Crumb[] = [];
  let acc: ArticleAccumulator | null = null;
  let preamble: string[] = [];

  const pushAcc = () => {
    if (!acc) return;
    const body = acc.buffer.join("\n").trim();
    if (!body) {
      acc = null;
      return;
    }
    const path = fullPathFromCrumbs(crumbs);
    if (body.length <= maxChars) {
      const c: LegalChunkV2 = {
        ordinal: chunks.length,
        structure: "ARTIGO",
        text: body,
      };
      if (path !== undefined) c.fullPath = path;
      if (acc.articleRef !== undefined) c.articleRef = acc.articleRef;
      if (acc.paragraphRef !== undefined) c.paragraphRef = acc.paragraphRef;
      if (acc.incisoRef !== undefined) c.incisoRef = acc.incisoRef;
      if (acc.alineaRef !== undefined) c.alineaRef = acc.alineaRef;
      chunks.push(c);
    } else {
      for (const piece of windowSplit(body, maxChars, overlap)) {
        if (!piece.trim()) continue;
        const c: LegalChunkV2 = {
          ordinal: chunks.length,
          structure: "ARTIGO",
          text: piece,
        };
        if (path !== undefined) c.fullPath = path;
        if (acc.articleRef !== undefined) c.articleRef = acc.articleRef;
        if (acc.paragraphRef !== undefined) c.paragraphRef = acc.paragraphRef;
        chunks.push(c);
      }
    }
    acc = null;
  };

  const pushPreamble = () => {
    const body = preamble.join("\n").trim();
    preamble = [];
    if (!body || body.length < minChars / 2) return;
    for (const piece of windowSplit(body, maxChars, overlap)) {
      const c: LegalChunkV2 = {
        ordinal: chunks.length,
        structure: "PREAMBULO",
        text: piece,
      };
      chunks.push(c);
    }
  };

  for (const line of lines) {
    const header = detectHeader(line);
    if (header) {
      pushAcc();
      crumbs = updateBreadcrumb(crumbs, header);
      if (header.structure === "ARTIGO") {
        acc = {
          ordinal: chunks.length,
          buffer: [line],
        };
        if (header.ref !== undefined) acc.articleRef = header.ref;
      } else {
        // header de seção/capítulo: o texto do header não vira chunk próprio,
        // só atualiza breadcrumb.
      }
      continue;
    }

    const intra = detectIntraArticle(line);
    if (intra && acc) {
      acc.buffer.push(line);
      if (intra.paragraphRef !== undefined) acc.paragraphRef = intra.paragraphRef;
      if (intra.incisoRef !== undefined) acc.incisoRef = intra.incisoRef;
      if (intra.alineaRef !== undefined) acc.alineaRef = intra.alineaRef;
      continue;
    }

    if (acc) {
      acc.buffer.push(line);
    } else {
      preamble.push(line);
    }
  }

  pushAcc();
  if (preamble.length > 0 && chunks.length === 0) {
    // Nada de hierarquia detectada → trata tudo como GENERIC com window.
    const body = preamble.join("\n").trim();
    if (!body) return [];
    return windowSplit(body, maxChars, overlap).map((piece, i) => ({
      ordinal: i,
      structure: "GENERIC" as LegalStructure,
      text: piece,
    }));
  }
  if (preamble.length > 0) pushPreamble();

  return chunks;
}
