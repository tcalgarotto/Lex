/**
 * Legal issue spotting — detecta issues jurídicas implícitas na query e nos
 * chunks recuperados, no estilo "issue spotting" do common law adaptado ao
 * direito brasileiro.
 *
 * Determinístico, baseado em:
 *  - termos-gatilho consagrados (responsabilidade civil, prescrição, vício
 *    de consentimento, prequestionamento, repercussão geral, etc.).
 *  - alinhamento com `LegalIntent` para herdar contexto (tribunal, kind).
 *  - heurísticas sobre `LegalRetrievedChunk` (ex.: presença de Art. 5º, CDC,
 *    súmula vinculante → issue de "direito fundamental"/"consumo").
 *
 * Saída: lista pequena (<=8) de issues priorizadas, cada uma com `evidence`
 * apontando para chunkIds que sustentam a hipótese.
 */

import type { LegalIntent } from "@/lib/retrieval/legal/intent";
import type { LegalRetrievedChunk } from "@/lib/retrieval/legal/types";

export type LegalIssue = {
  /** id estável (slug). */
  id: string;
  /** Título curto, voltado a advogado. */
  title: string;
  /** Categoria pra cores/agrupamentos no UI. */
  category:
    | "constitucional"
    | "consumo"
    | "civil"
    | "processual"
    | "penal"
    | "trabalhista"
    | "tributario"
    | "administrativo"
    | "diversos";
  /** 0..1 — força do sinal (combinação intent + chunks). */
  confidence: number;
  /** Chunk ids que sustentam a hipótese. */
  evidence: string[];
  /** Razão legível: "Termo X presente, norma Y indexada". */
  rationale: string;
};

type Trigger = {
  id: string;
  title: string;
  category: LegalIssue["category"];
  /** Termos que aparecendo na query sinalizam o issue. */
  queryPatterns: RegExp[];
  /** Termos que aparecendo no texto dos chunks reforçam. */
  chunkPatterns?: RegExp[];
  /** Identificadores normativos que reforçam (substring sobre URN/identifier). */
  normHints?: string[];
};

const TRIGGERS: Trigger[] = [
  {
    id: "responsabilidade-civil",
    title: "Responsabilidade civil (dever de indenizar)",
    category: "civil",
    queryPatterns: [
      /(respons[aá]bilidade\s+civil|dever\s+de\s+indenizar|dano\s+(moral|material|est[eé]tico)|nexo\s+causal)/i,
    ],
    chunkPatterns: [/Art\.\s*186|Art\.\s*927/i],
    normHints: ["constitucional", "lei:.*10406", "codigo civil"],
  },
  {
    id: "consumo",
    title: "Relação de consumo / direito do consumidor",
    category: "consumo",
    queryPatterns: [
      /(consumidor|cl[aá]usula\s+abusiva|direito\s+de\s+arrependimento|\bcdc\b|c[oó]digo\s+de\s+defesa|consumerista)/i,
    ],
    chunkPatterns: [/Art\.\s*49|Art\.\s*51|Art\.\s*6/i],
    normHints: ["lei:1990-09-11;8078"],
  },
  {
    id: "prescricao-decadencia",
    title: "Prescrição e decadência",
    category: "civil",
    queryPatterns: [/(prescri[cç][aã]o|decad[eê]ncia|prazo\s+prescricional)/i],
    chunkPatterns: [/Art\.\s*20[5-9]|Art\.\s*189/i],
  },
  {
    id: "direito-fundamental",
    title: "Direito fundamental (CF/88)",
    category: "constitucional",
    queryPatterns: [
      /\b(direito\s+fundamental|garantia\s+constitucional|cf\/?88|constitui(çã|c)?ão)\b/i,
    ],
    chunkPatterns: [/Art\.\s*5/i],
    normHints: ["constituicao:1988-10-05"],
  },
  {
    id: "devido-processo",
    title: "Devido processo legal / contraditório / ampla defesa",
    category: "constitucional",
    queryPatterns: [
      /\b(devido\s+processo|contradi(t|tó)rio|ampla\s+defesa|due\s+process)\b/i,
    ],
    chunkPatterns: [/inciso\s+(LIV|LV)|Art\.\s*5\s*[ºo°]?\s*,?\s*(LIV|LV)/i],
  },
  {
    id: "competencia",
    title: "Competência (jurisdição material/territorial)",
    category: "processual",
    queryPatterns: [/\b(compet(ê|e)ncia|foro\s+competente|justi(ç|c)a\s+competente)\b/i],
  },
  {
    id: "prequestionamento",
    title: "Prequestionamento e admissibilidade recursal",
    category: "processual",
    queryPatterns: [
      /\b(prequestionamento|admissibilidade\s+recursal|repercuss(ã|a)o\s+geral|recurso\s+especial|recurso\s+extraordin(á|a)rio)\b/i,
    ],
  },
  {
    id: "tutela-urgencia",
    title: "Tutela de urgência / antecipada",
    category: "processual",
    queryPatterns: [/\b(tutela\s+(de\s+)?urg(ê|e)ncia|antecipa(çã|c)?ão\s+de\s+tutela|liminar)\b/i],
    chunkPatterns: [/Art\.\s*300/i],
  },
  {
    id: "trabalhista-vinculo",
    title: "Vínculo empregatício / CLT",
    category: "trabalhista",
    queryPatterns: [/\b(v(í|i)nculo\s+empregat(í|i)cio|CLT|carteira\s+assinada|reconhecimento\s+de\s+v(í|i)nculo)\b/i],
  },
  {
    id: "tributo",
    title: "Tributo / cobrança / lançamento",
    category: "tributario",
    queryPatterns: [/\b(tribut(o|ária)|imposto|taxa|contribui(çã|c)?ão|cr(é|e)dito\s+tribut(á|a)rio|exec(u|ução)\s+fiscal)\b/i],
  },
  {
    id: "improbidade",
    title: "Improbidade administrativa",
    category: "administrativo",
    queryPatterns: [/\b(improbidade|enriquecimento\s+il(í|i)cito|lei\s+8\.?429)\b/i],
  },
  {
    id: "criminal-prescricao",
    title: "Prescrição penal / pretensão punitiva",
    category: "penal",
    queryPatterns: [/\b(prescri(çã|c)?ão\s+(penal|punitiva)|pretens(ã|a)o\s+punitiva)\b/i],
  },
];

/** Scoring: query match = 0.5; chunk match = 0.25; norm hint = 0.25. Capped 1.0. */
export function spotLegalIssues(args: {
  query: string;
  intent: LegalIntent;
  chunks: LegalRetrievedChunk[];
}): LegalIssue[] {
  const issues: LegalIssue[] = [];
  const allChunkText = args.chunks.map((c) => c.text).join("\n");
  const allHints = args.chunks
    .map((c) => `${c.norm.urn} ${c.norm.identifier ?? ""} ${c.norm.title}`.toLowerCase())
    .join("\n");

  for (const t of TRIGGERS) {
    let score = 0;
    const evidence: string[] = [];

    const queryHit = t.queryPatterns.some((p) => p.test(args.query));
    if (queryHit) score += 0.5;

    if (t.chunkPatterns) {
      for (const c of args.chunks) {
        if (t.chunkPatterns.some((p) => p.test(c.text))) {
          evidence.push(c.chunkId);
        }
      }
      if (evidence.length > 0) score += 0.25;
    } else if (t.queryPatterns.some((p) => p.test(allChunkText))) {
      score += 0.15;
    }

    if (t.normHints) {
      const matched = t.normHints.some((h) => allHints.includes(h.toLowerCase()));
      if (matched) score += 0.25;
    }

    // Boost por intent já alinhado
    if (
      t.id === "consumo" &&
      args.intent.preferredKinds.some((k) => k.toString().includes("ORDINARY_LAW"))
    ) {
      score += 0.05;
    }
    if (t.id === "direito-fundamental" && args.intent.preferredKinds.some((k) => k === "CONSTITUTION")) {
      score += 0.05;
    }

    if (score >= 0.5) {
      issues.push({
        id: t.id,
        title: t.title,
        category: t.category,
        confidence: Math.min(1, score),
        evidence,
        rationale: buildRationale(t, queryHit, evidence.length, !!t.normHints),
      });
    }
  }

  // Top-8 mais prováveis, ordenadas por confidence desc
  return issues.sort((a, b) => b.confidence - a.confidence).slice(0, 8);
}

function buildRationale(t: Trigger, queryHit: boolean, evidenceCount: number, hasNormHints: boolean): string {
  const bits: string[] = [];
  if (queryHit) bits.push("termos-gatilho na query");
  if (evidenceCount > 0) bits.push(`${evidenceCount} trecho(s) recuperado(s) com termos correlatos`);
  if (hasNormHints) bits.push("norma de referência indexada");
  if (bits.length === 0) bits.push("indícios fracos");
  return bits.join(" • ");
}
