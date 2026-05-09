/**
 * Chunker jurídico v3 — gera chunks "filhos" para artigos longos (F3.5).
 *
 * Estratégia:
 *  - Mantém o comportamento do v2 (chunk pai por artigo).
 *  - Quando o artigo é "longo" (`text.length > 1200` ou tem `incisos.count > 3`):
 *    produz chunks filhos adicionais — um por inciso/§/alínea — com
 *    `articleRef`/`incisoRef`/`paragraphRef` corretamente preenchidos.
 *  - Cada filho herda `urn`, `fullPath` (com inciso anexado) e
 *    `chunkerVersion = "v3"`.
 *
 * Ainda usa o v2 como base para evitar duplicação de regex/breadcrumb
 * — só adiciona pós-processamento de "fan-out" em artigos longos.
 */

import { chunkLegalNorm, type LegalChunkV2 } from "./legal-chunker-v2";

export const CHUNKER_VERSION_V3 = "v3";

export type LegalChunkV3 = LegalChunkV2 & {
  /** ordinal do chunk pai dentro da norma; null para chunks-pai. */
  parentOrdinal?: number | null;
  /** Indica que esse chunk é um filho recortado (inciso/§/alínea). */
  isChild?: boolean;
  chunkerVersion: "v2" | "v3";
};

const LONG_TEXT_THRESHOLD = 1200;
const MIN_INCISOS_TO_FANOUT = 4;

/** Regex para identificar incisos no corpo (linha começando com romano + travessão). */
const INCISO_LINE_RE = /^([IVXLCDM]+)\s*[—\-–]\s*(.+)$/i;
const PARAGRAPH_LINE_RE = /^§\s*(\d+|único|UNICO)\s*º?\s*[\.\-—]?\s*(.+)$/i;
const ALINEA_LINE_RE = /^([a-z])\)\s+(.+)$/i;

export function chunkLegalNormV3(
  rawText: string,
  options: { maxChars?: number; overlap?: number; minChars?: number } = {},
): LegalChunkV3[] {
  const baseChunks = chunkLegalNorm(rawText, options);
  const out: LegalChunkV3[] = [];
  for (const parent of baseChunks) {
    out.push({ ...parent, chunkerVersion: "v2", parentOrdinal: null, isChild: false });
    if (parent.structure !== "ARTIGO") continue;
    const children = explodeArticleChildren(parent);
    for (const child of children) {
      out.push({
        ...child,
        chunkerVersion: "v3",
        parentOrdinal: parent.ordinal,
        isChild: true,
      });
    }
  }
  // Recalcula ordinal sequencial.
  return out.map((c, i) => ({ ...c, ordinal: i }));
}

function explodeArticleChildren(parent: LegalChunkV2): LegalChunkV2[] {
  if (!parent.text) return [];
  const incisos = collectIncisos(parent.text);
  const paragraphs = collectParagraphs(parent.text);
  const shouldFanout =
    parent.text.length > LONG_TEXT_THRESHOLD || incisos.length >= MIN_INCISOS_TO_FANOUT;
  if (!shouldFanout) return [];

  const out: LegalChunkV2[] = [];

  for (const inc of incisos) {
    const child: LegalChunkV2 = {
      ordinal: 0,
      structure: "INCISO",
      text: inc.text,
    };
    if (parent.articleRef) child.articleRef = parent.articleRef;
    child.incisoRef = inc.ref;
    if (parent.fullPath) child.fullPath = `${parent.fullPath} › inciso ${inc.ref}`;
    out.push(child);
  }

  for (const par of paragraphs) {
    const child: LegalChunkV2 = {
      ordinal: 0,
      structure: "PARAGRAFO",
      text: par.text,
    };
    if (parent.articleRef) child.articleRef = parent.articleRef;
    child.paragraphRef = par.ref;
    if (parent.fullPath) child.fullPath = `${parent.fullPath} › ${par.ref}`;
    out.push(child);
  }

  return out;
}

function collectIncisos(text: string): { ref: string; text: string }[] {
  const out: { ref: string; text: string }[] = [];
  const lines = text.split("\n");
  let cur: { ref: string; buf: string[] } | null = null;
  for (const line of lines) {
    const m = INCISO_LINE_RE.exec(line.trim());
    if (m && m[1]) {
      if (cur) out.push({ ref: cur.ref, text: cur.buf.join("\n").trim() });
      cur = { ref: m[1].toUpperCase(), buf: [line] };
      continue;
    }
    if (cur) {
      // Encerra inciso ao ver um § ou outro romano de mesmo padrão
      if (PARAGRAPH_LINE_RE.test(line.trim())) {
        out.push({ ref: cur.ref, text: cur.buf.join("\n").trim() });
        cur = null;
        continue;
      }
      cur.buf.push(line);
    }
  }
  if (cur) out.push({ ref: cur.ref, text: cur.buf.join("\n").trim() });
  return out.filter((i) => i.text.length > 12);
}

function collectParagraphs(text: string): { ref: string; text: string }[] {
  const out: { ref: string; text: string }[] = [];
  const lines = text.split("\n");
  let cur: { ref: string; buf: string[] } | null = null;
  for (const line of lines) {
    const m = PARAGRAPH_LINE_RE.exec(line.trim());
    if (m && m[1]) {
      if (cur) out.push({ ref: cur.ref, text: cur.buf.join("\n").trim() });
      const refRaw = m[1];
      const ref =
        refRaw.toLowerCase() === "único" || refRaw.toLowerCase() === "unico"
          ? "Parágrafo único"
          : `§ ${refRaw}`;
      cur = { ref, buf: [line] };
      continue;
    }
    // Alinea sob parágrafo é incluída no body do §.
    if (cur) {
      if (INCISO_LINE_RE.test(line.trim()) && cur.buf.length > 1) {
        out.push({ ref: cur.ref, text: cur.buf.join("\n").trim() });
        cur = null;
        continue;
      }
      cur.buf.push(line);
    } else if (ALINEA_LINE_RE.test(line.trim()) && out.length > 0) {
      // alínea isolada após parágrafo já fechado — anexa ao último.
      const last = out.at(-1);
      if (last) last.text = `${last.text}\n${line}`;
    }
  }
  if (cur) out.push({ ref: cur.ref, text: cur.buf.join("\n").trim() });
  return out.filter((p) => p.text.length > 12);
}
