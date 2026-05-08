/**
 * Sparse vector jurídico — vocabulário forte + hashing estável.
 *
 * Geramos vetores esparsos compatíveis com o tipo `sparse_vectors.keywords`
 * do Qdrant, sem dependência externa (sem `pyserini`, sem SPLADE, sem
 * `bge-m3-sparse`). A representação é determinística e idempotente: mesmo
 * texto → mesmos `(indices[], values[])`.
 *
 * Pipeline:
 *  1. `tokenizeLegal(text)` — corta em palavras + extrai n-grams jurídicos
 *     (ex.: "art. 5º, LIV" → tokens ["art", "5", "liv", "art_5", "art_5_liv"]).
 *  2. `normalizeLegalToken` — strip acentos, lowercase, mapeamentos jurídicos
 *     (`§` → `paragrafo`, `art.` → `art`, etc.).
 *  3. `stableSparseIndex` — hash 32-bit estável (FNV-1a) → módulo
 *     `SPARSE_DIMENSION` (~1M). Sem dependência native.
 *  4. Pesos heurísticos:
 *     - Boost em `articleRef`/`paragraphRef`/`incisoRef`/`alineaRef`
 *       (do metadata, valor 4.0).
 *     - Boost em `codigo`/`tema`/`tipo` (3.0).
 *     - Boost em palavras do `hierarchy` (2.0).
 *     - Texto livre: TF padrão com saturação log(1+tf).
 *
 * Risco de colisão: dimensão virtual = 2^20 = 1 048 576. Para um corpus de
 * 514 chunks × ~120 termos únicos cada → ~62k termos, P(colisão) ≈
 * 62k² / 2M ≈ 0.5%. Aceitável dada a baixa entropia do vocabulário jurídico
 * e o reranker downstream (cross-encoder BGE-v2-m3) que lida com ruído.
 *
 * Não usa `randomUUID`/`Math.random` — output 100% determinístico.
 */

import type { LegalIntent } from "./intent";

/** Dimensão virtual do espaço sparse. 2^20 = 1 048 576. */
export const SPARSE_DIMENSION = 1 << 20;

/** Forma do vetor sparse compatível com Qdrant `SparseVector`. */
export type SparseVector = {
  indices: number[];
  values: number[];
};

/** Metadata mínima usada para boostar termos jurídicos canônicos. */
export type LegalChunkMeta = {
  codigo?: string | null;
  tipo?: string | null;
  tema?: string | null;
  hierarchy?: string | null;
  articleRef?: string | null;
  paragraphRef?: string | null;
  incisoRef?: string | null;
  alineaRef?: string | null;
};

/* ----------------------------------------------------------------- */
/*                       1. Hashing estável                          */
/* ----------------------------------------------------------------- */

/**
 * FNV-1a 32-bit. Determinístico em qualquer plataforma.
 * Ref: http://www.isthe.com/chongo/tech/comp/fnv/
 */
function fnv1a32(s: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    // Multiplicação `hash * 0x01000193` em `>>> 0` para manter unsigned 32-bit.
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Mapeia um termo para índice sparse estável em [0, SPARSE_DIMENSION).
 * Determinístico: `stableSparseIndex("art_5") === stableSparseIndex("art_5")`.
 */
export function stableSparseIndex(term: string): number {
  return fnv1a32(term) % SPARSE_DIMENSION;
}

/* ----------------------------------------------------------------- */
/*                       2. Normalização                              */
/* ----------------------------------------------------------------- */

/**
 * Mapa de substituições semânticas — aplicado ANTES da remoção de acentos
 * para que tokens compostos como "§" virem palavras tokenizáveis.
 */
const SEMANTIC_REPLACEMENTS: Array<[RegExp, string]> = [
  [/§+/g, " paragrafo "],
  [/§\s*único/gi, " paragrafo unico "],
  [/\bart\.?\b/gi, " art "],
  [/\bartigos?\b/gi, " art "],
  [/\bartº\b/gi, " art "],
  [/\binciso\b/gi, " inciso "],
  [/\balínea\b/gi, " alinea "],
  [/\balinea\b/gi, " alinea "],
  [/\bcaput\b/gi, " caput "],
  [/\bsúmula\b/gi, " sumula "],
  [/\bsumula\b/gi, " sumula "],
  // Sufixo de artigo "219-A" → "219a" para sobreviver ao split (hífen é
  // separador). Mantém a letra junto do número para o n-gram `art_219a`.
  [/(\d+)\s*-\s*([a-z])\b/gi, "$1$2"],
];

/**
 * Strip acentos via decomposição NFD + remoção de combining marks.
 * Mantém ASCII puro.
 */
function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Normaliza um token jurídico para forma canônica.
 *
 * Regras:
 *  - lowercase
 *  - sem acentos
 *  - remove pontuação residual (mantém `_` e dígitos)
 *  - colapsa whitespace
 */
export function normalizeLegalToken(token: string): string {
  return stripAccents(token.toLowerCase())
    .replace(/[^a-z0-9_]+/g, "")
    .trim();
}

/* ----------------------------------------------------------------- */
/*                       3. Tokenização                               */
/* ----------------------------------------------------------------- */

/**
 * Stop-words brasileiras curtas — não vão pro sparse (ruído puro).
 * Lista minimalista; a bandeira é "remover preposições/conjuntivas comuns".
 */
const STOP = new Set<string>([
  "a", "o", "as", "os", "e", "ou", "de", "do", "da", "dos", "das",
  "no", "na", "nos", "nas", "em", "se", "com", "para", "por",
  "que", "ao", "aos", "à", "às", "um", "uma", "uns", "umas",
  "mais", "menos", "muito", "pouco", "sao", "ser", "tem", "ter",
  "ja", "ainda", "tambem", "como", "isto", "isso", "aquilo",
]);

/** Romanos comuns em incisos (I-XXX). */
const ROMAN_RE = /^(?:[ivxlcdm]+)$/i;

/** Detecta token como número de artigo (ex.: "5", "5a", "92a", "219b"). */
const ARTICLE_NUM_RE = /^(\d{1,3})([a-z]?)$/i;

/**
 * Tokeniza texto jurídico em palavras + n-grams jurídicos canônicos.
 *
 * Output ordenado, com duplicatas (cada ocorrência conta para TF).
 *
 * Exemplos:
 *  - "Art. 5º, LIV" → ["art", "5", "liv", "art_5", "art_5_liv"]
 *  - "§ 2º do art. 37" → ["paragrafo", "2", "art", "37", "art_37", "paragrafo_2"]
 */
export function tokenizeLegal(text: string): string[] {
  if (!text) return [];

  let s = text;
  for (const [re, sub] of SEMANTIC_REPLACEMENTS) {
    s = s.replace(re, sub);
  }
  s = stripAccents(s.toLowerCase());

  // Quebra em palavras (mantém dígitos colados a letras: "5o", "219a").
  const raw = s
    .split(/[^a-z0-9]+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0);

  const tokens: string[] = [];

  // Pass 1: tokens individuais filtrando stop e ordinais "º"/"ª".
  for (const w of raw) {
    // Mantém dígitos single-char ("2", "5") e roman single-char ("i", "v"...).
    // Filtra letras single-char comuns ("a", "o" — quase sempre stopword).
    if (w.length === 1 && !ROMAN_RE.test(w) && !/^\d$/.test(w)) continue;
    // Strip do "o" final em ordinais masculinos digitados sem superscript
    // (ex.: "5o" → "5"). NÃO strip 'a' final — colide com sufixos legítimos
    // de artigo (ex.: "219a" deve ser preservado para gerar `art_219a`).
    const stripped = /^\d{1,3}o$/i.test(w) ? w.slice(0, -1) : w;
    if (STOP.has(stripped)) continue;
    if (stripped.length === 0) continue;
    tokens.push(stripped);
  }

  // Pass 2: detectar `art <N>` e `paragrafo <N>` e `inciso <ROMAN>` para
  //         emitir n-grams `art_<N>` e `art_<N>_<ROMAN>`.
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;

    if (t === "art" && i + 1 < tokens.length) {
      const next = tokens[i + 1]!;
      const m = ARTICLE_NUM_RE.exec(next);
      if (m) {
        const numToken = `art_${m[1]}${m[2]?.toLowerCase() ?? ""}`;
        tokens.push(numToken);
        // Trigram `art_<N>_<ROMAN>` se houver inciso na sequência.
        const ahead = tokens[i + 2];
        if (ahead && ROMAN_RE.test(ahead)) {
          tokens.push(`${numToken}_${ahead.toLowerCase()}`);
        }
      }
    }

    if (t === "paragrafo" && i + 1 < tokens.length) {
      const next = tokens[i + 1]!;
      if (/^\d{1,3}$/.test(next)) {
        tokens.push(`paragrafo_${next}`);
      } else if (next === "unico") {
        tokens.push("paragrafo_unico");
      }
    }

    if (t === "inciso" && i + 1 < tokens.length) {
      const next = tokens[i + 1]!;
      if (ROMAN_RE.test(next)) {
        tokens.push(`inciso_${next.toLowerCase()}`);
      }
    }
  }

  return tokens;
}

/* ----------------------------------------------------------------- */
/*                4. Builders de SparseVector                         */
/* ----------------------------------------------------------------- */

/** Boost por origem do termo. */
const W_TEXT_BASE = 1.0;
const W_ARTICLE = 4.0;
const W_PARAGRAPH = 3.5;
const W_INCISO = 3.5;
const W_ALINEA = 3.0;
const W_CODIGO = 3.0;
const W_TEMA = 3.0;
const W_TIPO = 3.0;
const W_HIERARCHY = 2.0;
const W_INTENT_URN = 5.0;
const W_INTENT_ARTICLE = 5.0;
const W_INTENT_TRIBUNAL = 4.0;

/** Saturação log(1+tf) — evita explodir scores em chunks repetitivos. */
function tfWeight(count: number): number {
  return Math.log1p(count);
}

/**
 * Acumula pesos num map (term → weight), com saturação por termo.
 * Termos repetidos no mesmo "campo" somam linearmente; cross-campos
 * mantêm o máximo (assim, um termo do `text` não derruba o boost vindo
 * de `articleRef`).
 */
type AccumulatorEntry = { count: number; boost: number };
class WeightAccumulator {
  private map = new Map<string, AccumulatorEntry>();

  add(term: string, boost: number): void {
    const key = normalizeLegalToken(term);
    if (!key) return;
    const cur = this.map.get(key);
    if (!cur) {
      this.map.set(key, { count: 1, boost });
    } else {
      cur.count += 1;
      cur.boost = Math.max(cur.boost, boost);
    }
  }

  toSparse(): SparseVector {
    const indices: number[] = [];
    const values: number[] = [];
    // Indices ordenados — exigência do Qdrant para sparse vectors.
    const sortedTerms = Array.from(this.map.entries()).map(([term, e]) => ({
      idx: stableSparseIndex(term),
      val: tfWeight(e.count) * e.boost,
    }));
    // Resolver colisão por índice (somar weights — forma natural).
    const collapsed = new Map<number, number>();
    for (const { idx, val } of sortedTerms) {
      collapsed.set(idx, (collapsed.get(idx) ?? 0) + val);
    }
    const sortedIdx = Array.from(collapsed.keys()).sort((a, b) => a - b);
    for (const idx of sortedIdx) {
      indices.push(idx);
      values.push(Number(collapsed.get(idx)!.toFixed(6)));
    }
    return { indices, values };
  }
}

/** Adiciona n-grams de uma string de metadata (já que vêm bem formatadas). */
function feedFromMetadata(acc: WeightAccumulator, raw: string | undefined | null, weight: number): void {
  if (!raw) return;
  for (const t of tokenizeLegal(raw)) {
    acc.add(t, weight);
  }
}

/**
 * Constrói o vetor sparse para um chunk legal indexado.
 *
 * @param text   Texto do chunk (já enriquecido com prefixo legal canônico).
 * @param meta   Metadata canônica (`codigo`, `tipo`, `articleRef`, etc.).
 * @returns      `SparseVector` (indices ordenados, values float).
 */
export function buildLegalSparseVector(
  text: string,
  meta: LegalChunkMeta = {},
): SparseVector {
  const acc = new WeightAccumulator();

  // Texto livre — peso base.
  for (const t of tokenizeLegal(text)) {
    acc.add(t, W_TEXT_BASE);
  }

  // Metadata jurídica canônica — boosts altos.
  feedFromMetadata(acc, meta.articleRef, W_ARTICLE);
  feedFromMetadata(acc, meta.paragraphRef, W_PARAGRAPH);
  feedFromMetadata(acc, meta.incisoRef, W_INCISO);
  feedFromMetadata(acc, meta.alineaRef, W_ALINEA);
  feedFromMetadata(acc, meta.codigo, W_CODIGO);
  feedFromMetadata(acc, meta.tema, W_TEMA);
  feedFromMetadata(acc, meta.tipo, W_TIPO);
  feedFromMetadata(acc, meta.hierarchy, W_HIERARCHY);

  return acc.toSparse();
}

/**
 * Constrói o vetor sparse de **query** (busca). Usa o intent extraído pelo
 * classifier para boostar URNs/artigos/tribunais detectados na pergunta.
 *
 * @param query   Texto da pergunta do usuário.
 * @param intent  `LegalIntent` (opcional). Quando ausente, sparse depende só
 *                do texto — útil pra testes e callers sem intent.
 */
export function buildLegalSparseQuery(
  query: string,
  intent?: Pick<LegalIntent, "urns" | "articleRefs" | "tribunals">,
): SparseVector {
  const acc = new WeightAccumulator();

  for (const t of tokenizeLegal(query)) {
    acc.add(t, W_TEXT_BASE);
  }

  if (intent?.urns?.length) {
    for (const urn of intent.urns) {
      // URN canônico (ex.: "urn:lex:br:federal:lei:1990-09-11;8078") tem
      // segmentos ricos para boost — tokenize tudo.
      for (const t of tokenizeLegal(urn)) {
        acc.add(t, W_INTENT_URN);
      }
    }
  }
  if (intent?.articleRefs?.length) {
    for (const ref of intent.articleRefs) {
      for (const t of tokenizeLegal(ref)) {
        acc.add(t, W_INTENT_ARTICLE);
      }
    }
  }
  if (intent?.tribunals?.length) {
    for (const trib of intent.tribunals) {
      acc.add(trib, W_INTENT_TRIBUNAL);
    }
  }

  return acc.toSparse();
}

/* ----------------------------------------------------------------- */
/*                          5. Helpers de teste                       */
/* ----------------------------------------------------------------- */

/**
 * Apenas para testes/debug: converte uma sparse vector em map ordenado por
 * peso decrescente, com chaves humanas reconstruídas. As chaves vêm como
 * `idx@<n>` porque a função de hash é one-way.
 */
export function explainSparseVector(v: SparseVector, top = 10): string[] {
  const pairs = v.indices.map((idx, i) => ({ idx, val: v.values[i] ?? 0 }));
  pairs.sort((a, b) => b.val - a.val);
  return pairs.slice(0, top).map((p) => `idx=${p.idx}\tval=${p.val.toFixed(4)}`);
}
