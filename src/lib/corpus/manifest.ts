/**
 * Corpus manifest (F4.1).
 *
 * Quem usa Drafting/Review precisa saber EXATAMENTE quais normas estão
 * indexadas e quais ainda não estão. Sem isso, o sistema cita "art. 300
 * CPC" como se tivesse recuperado via RAG quando o CPC sequer foi
 * ingerido — risco regulatório/auditoria.
 *
 * Implementação:
 *  - `availableNorms`: lê `LegalNorm` ativos do Postgres.
 *  - `unavailableHints`: lista estática de normas conhecidamente
 *    relevantes mas ainda fora do corpus (CPC, ECA, LDB, Lei 12.016/2009,
 *    CDC, Código Civil). Exposta em UI/Drafter.
 *  - Cache em memória por TTL curto (5 min) para não bater no Postgres
 *    em cada drafting.
 */

import { prisma } from "@/lib/prisma";

export type CorpusManifestNorm = {
  urn: string;
  label: string;
  kind: string;
  jurisdiction: string;
};

export type CorpusManifestHint = {
  label: string;
  /** Padrão URN canônico (ex.: `urn:lex:br:federal:lei:13.105:2015`). */
  urnPattern: string;
  /** Razão pela qual ainda não foi indexada (UI hint). */
  reason?: string;
};

export type CorpusManifest = {
  availableUrns: Set<string>;
  availableNorms: CorpusManifestNorm[];
  unavailableHints: CorpusManifestHint[];
  generatedAt: Date;
  /** True se a leitura caiu em fallback (postgres indisponível). */
  degraded: boolean;
};

const TTL_MS = 5 * 60 * 1000;

let cached: { value: CorpusManifest; expiresAt: number } | null = null;

const UNAVAILABLE_HINTS: CorpusManifestHint[] = [
  {
    label: "Lei do Mandado de Segurança (Lei 12.016/2009)",
    urnPattern: "urn:lex:br:federal:lei:12.016:2009",
    reason: "Indexação prevista para próxima onda.",
  },
  {
    label: "Código de Processo Civil (Lei 13.105/2015)",
    urnPattern: "urn:lex:br:federal:lei:13.105:2015",
    reason: "Indexação prevista para próxima onda.",
  },
  {
    label: "Estatuto da Criança e do Adolescente (Lei 8.069/1990)",
    urnPattern: "urn:lex:br:federal:lei:8.069:1990",
    reason: "Indexação prevista para próxima onda.",
  },
  {
    label: "Lei de Diretrizes e Bases da Educação (Lei 9.394/1996)",
    urnPattern: "urn:lex:br:federal:lei:9.394:1996",
    reason: "Indexação prevista para próxima onda.",
  },
  {
    label: "Código de Defesa do Consumidor (Lei 8.078/1990)",
    urnPattern: "urn:lex:br:federal:lei:8.078:1990",
    reason: "Indexação prevista para próxima onda.",
  },
  {
    label: "Código Civil (Lei 10.406/2002)",
    urnPattern: "urn:lex:br:federal:lei:10.406:2002",
    reason: "Indexação prevista para próxima onda.",
  },
  {
    label: "Jurisprudência STF/STJ/TST",
    urnPattern: "urn:lex:br:*:jurisprudencia:*",
    reason: "Coleta automática prevista para próxima onda.",
  },
];

export async function getCorpusManifest(): Promise<CorpusManifest> {
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.value;

  let availableNorms: CorpusManifestNorm[] = [];
  let degraded = false;
  try {
    const norms = await prisma.legalNorm.findMany({
      select: {
        urn: true,
        title: true,
        identifier: true,
        kind: true,
        jurisdiction: true,
      },
      take: 1000,
    });
    availableNorms = norms.map((n) => ({
      urn: n.urn,
      label: n.identifier ?? n.title ?? n.urn,
      kind: n.kind,
      jurisdiction: n.jurisdiction,
    }));
  } catch {
    degraded = true;
  }

  const value: CorpusManifest = {
    availableUrns: new Set(availableNorms.map((n) => n.urn)),
    availableNorms,
    unavailableHints: UNAVAILABLE_HINTS,
    generatedAt: new Date(),
    degraded,
  };
  cached = { value, expiresAt: now + TTL_MS };
  return value;
}

/**
 * Verifica se uma URN específica está disponível no corpus indexado.
 * Aceita match parcial (ex.: `urn:lex:br:federal:lei:13.105:2015::art_300`
 * passa quando a norma `urn:lex:br:federal:lei:13.105:2015` existe).
 */
export async function hasUrn(urn: string | null | undefined): Promise<boolean> {
  if (!urn) return false;
  const m = await getCorpusManifest();
  if (m.availableUrns.has(urn)) return true;
  // Match prefixo: artigo dentro de uma norma indexada.
  const normPart = urn.split("::")[0];
  if (normPart && m.availableUrns.has(normPart)) return true;
  return false;
}

export async function isHintedAsUnavailable(label: string): Promise<boolean> {
  const m = await getCorpusManifest();
  return m.unavailableHints.some((h) =>
    label.toLowerCase().includes(h.label.toLowerCase().slice(0, 12)),
  );
}

export function _resetManifestCache(): void {
  cached = null;
}
