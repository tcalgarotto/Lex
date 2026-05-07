/**
 * Timeline-aware reasoning: linha do tempo das normas envolvidas no retrieval.
 *
 * Para cada norma, traz a sequência cronológica de:
 *   - publicação (`publishedAt`).
 *   - vigência atual (`validFrom`/`validTo` da última versão).
 *   - revogações conhecidas via `LegalCitation { kind: REVOKES }`.
 *
 * Determinístico, não usa LLM. Saída pronta pra renderização visual.
 */

import { CitationKind, type NormJurisdiction, type NormKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type TimelineEvent = {
  /** ISO date YYYY-MM-DD. Normalizado pra ordenação estável. */
  date: string;
  kind: "published" | "in_force" | "revoked" | "amended" | "version";
  label: string;
  /** Detalhe legível (ex.: "Revogou a Lei 8.666/93"). */
  detail?: string;
  /** URN da norma central deste evento. */
  normUrn: string;
};

export type NormTimeline = {
  norm: {
    id: string;
    urn: string;
    kind: NormKind;
    jurisdiction: NormJurisdiction;
    title: string;
    identifier: string | null;
  };
  events: TimelineEvent[];
  /** Resumo mínimo pra mostrar como header. */
  summary: {
    publishedAt: string | null;
    inForceFrom: string | null;
    inForceUntil: string | null;
    isCurrent: boolean;
  };
};

const ZERO_DATE = "0000-00-00";

function toDateKey(d: Date | null | undefined): string {
  if (!d) return ZERO_DATE;
  return d.toISOString().slice(0, 10);
}

/**
 * Constrói timelines para um conjunto de normIds (em geral, os normIds dos
 * chunks retornados pelo retrieval).
 */
export async function buildTimelines(args: {
  normIds: string[];
  asOf?: Date;
}): Promise<NormTimeline[]> {
  if (args.normIds.length === 0) return [];
  const asOf = args.asOf ?? new Date();

  const norms = await prisma.legalNorm.findMany({
    where: { id: { in: args.normIds } },
    include: {
      versions: {
        select: { id: true, validFrom: true, validTo: true, contentHash: true },
        orderBy: { validFrom: "asc" },
      },
      citationsFrom: {
        where: { kind: CitationKind.REVOKES },
        select: { targetUrn: true, target: { select: { title: true, identifier: true } } },
      },
      citationsTo: {
        where: { kind: CitationKind.REVOKES },
        select: { source: { select: { title: true, identifier: true, urn: true } } },
      },
    },
  });

  return norms
    .map((n) => {
      const events: TimelineEvent[] = [];

      if (n.publishedAt) {
        events.push({
          date: toDateKey(n.publishedAt),
          kind: "published",
          label: "Publicação",
          detail: n.identifier ?? n.title,
          normUrn: n.urn,
        });
      }

      // Versões (snapshots temporais)
      n.versions.forEach((v, i) => {
        events.push({
          date: toDateKey(v.validFrom),
          kind: i === 0 ? "in_force" : "version",
          label: i === 0 ? "Em vigor" : `Versão ${i + 1}`,
          detail:
            v.validTo
              ? `Vigência de ${toDateKey(v.validFrom)} até ${toDateKey(v.validTo)}`
              : `Vigência iniciada em ${toDateKey(v.validFrom)}`,
          normUrn: n.urn,
        });
        if (v.validTo) {
          events.push({
            date: toDateKey(v.validTo),
            kind: "amended",
            label: "Alteração de versão",
            detail: `Versão substituída em ${toDateKey(v.validTo)}`,
            normUrn: n.urn,
          });
        }
      });

      // Revogou outras normas
      for (const c of n.citationsFrom) {
        events.push({
          date: toDateKey(n.publishedAt),
          kind: "revoked",
          label: "Revogou",
          detail: c.target?.identifier ?? c.target?.title ?? c.targetUrn ?? "norma anterior",
          normUrn: n.urn,
        });
      }

      // Foi revogada por outra norma
      for (const c of n.citationsTo) {
        events.push({
          date: ZERO_DATE,
          kind: "revoked",
          label: "Revogada por",
          detail: c.source.identifier ?? c.source.title,
          normUrn: c.source.urn,
        });
      }

      events.sort((a, b) => a.date.localeCompare(b.date));

      const lastVersion = n.versions[n.versions.length - 1];
      const inForceFrom = lastVersion ? toDateKey(lastVersion.validFrom) : null;
      const inForceUntil = lastVersion?.validTo ? toDateKey(lastVersion.validTo) : null;
      const isCurrent =
        !!lastVersion &&
        lastVersion.validFrom <= asOf &&
        (!lastVersion.validTo || lastVersion.validTo > asOf) &&
        n.citationsTo.length === 0;

      return {
        norm: {
          id: n.id,
          urn: n.urn,
          kind: n.kind,
          jurisdiction: n.jurisdiction,
          title: n.title,
          identifier: n.identifier,
        },
        events,
        summary: {
          publishedAt: n.publishedAt ? toDateKey(n.publishedAt) : null,
          inForceFrom,
          inForceUntil,
          isCurrent,
        },
      };
    })
    // Ordena por mais recente primeiro
    .sort((a, b) => (b.summary.publishedAt ?? "").localeCompare(a.summary.publishedAt ?? ""));
}
