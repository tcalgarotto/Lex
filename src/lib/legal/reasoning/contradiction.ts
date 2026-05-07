/**
 * Contradiction & risk detection — sinaliza inconsistências jurídicas que
 * podem comprometer o uso direto dos chunks recuperados.
 *
 * Sinais detectados (determinísticos):
 *   - Norma revogada que ainda apareceu como fonte (REVOKES via citationsTo).
 *   - Conflito temporal (norma anterior e norma posterior sobre o mesmo
 *     tema, sendo a anterior expressamente revogada).
 *   - Divergência entre tribunais (mesmo tema, STF e STJ, com kinds
 *     SUMULA_ ou JURISPRUDENCE_) — risk: "tese diverge entre tribunais".
 *   - Versão histórica usada como vigente (validTo anterior ao asOf).
 *   - Súmula vinculante mencionada mas não recuperada (gap de fundamentação).
 */

import { CitationKind, type LegalCitation, type NormKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { LegalIntent } from "@/lib/retrieval/legal/intent";
import type { LegalRetrievedChunk } from "@/lib/retrieval/legal/types";

export type ContradictionRisk = {
  id: string;
  /** Severidade: "alta" bloqueia conclusão, "media" requer cautela, "baixa" informativo. */
  severity: "alta" | "media" | "baixa";
  title: string;
  detail: string;
  /** Chunks/normas envolvidos (por chunkId ou normUrn). */
  evidence: { chunkIds: string[]; normUrns: string[] };
};

export async function detectContradictions(args: {
  chunks: LegalRetrievedChunk[];
  intent: LegalIntent;
  asOf?: Date;
}): Promise<ContradictionRisk[]> {
  const out: ContradictionRisk[] = [];
  if (args.chunks.length === 0) return out;
  const asOf = args.asOf ?? new Date();

  const normIds = Array.from(new Set(args.chunks.map((c) => c.norm.id)));

  // 1) Versão histórica usada como vigente
  for (const c of args.chunks) {
    if (c.validTo && c.validTo <= asOf) {
      out.push({
        id: `historic-version:${c.chunkId}`,
        severity: "alta",
        title: "Versão histórica recuperada como atual",
        detail: `O trecho de ${c.norm.identifier ?? c.norm.title}${c.fullPath ? ` (${c.fullPath})` : ""} corresponde a uma versão que vigeu apenas até ${c.validTo.toISOString().slice(0, 10)}. Não use como fundamentação atual sem checar a redação vigente.`,
        evidence: { chunkIds: [c.chunkId], normUrns: [c.norm.urn] },
      });
    }
  }

  // 2) Norma revogada (citationsTo com REVOKES) usada como fonte
  type RevokedRow = Pick<LegalCitation, "sourceNormId" | "targetNormId">;
  const revokes: RevokedRow[] = await prisma.legalCitation.findMany({
    where: {
      kind: CitationKind.REVOKES,
      targetNormId: { in: normIds },
    },
    select: { sourceNormId: true, targetNormId: true },
  });
  if (revokes.length > 0) {
    const revokedNormIds = new Set(revokes.map((r) => r.targetNormId).filter(Boolean) as string[]);
    const revokedChunks = args.chunks.filter((c) => revokedNormIds.has(c.norm.id));
    if (revokedChunks.length > 0) {
      out.push({
        id: "revoked-norm-cited",
        severity: "alta",
        title: "Norma revogada presente na fundamentação",
        detail: `${revokedChunks.length} trecho(s) referem-se a normas que foram expressamente revogadas. Antes de citar, valide se ainda há aplicação subsidiária ou direito intertemporal.`,
        evidence: {
          chunkIds: revokedChunks.map((c) => c.chunkId),
          normUrns: Array.from(new Set(revokedChunks.map((c) => c.norm.urn))),
        },
      });
    }
  }

  // 3) Divergência entre tribunais (mesmos tema, kinds SUMULA_/JURISPRUDENCE_)
  const stfChunks = args.chunks.filter((c) => c.norm.tribunal?.startsWith("STF"));
  const stjChunks = args.chunks.filter((c) => c.norm.tribunal?.startsWith("STJ"));
  if (stfChunks.length > 0 && stjChunks.length > 0) {
    out.push({
      id: "divergencia-tribunais",
      severity: "media",
      title: "Possível divergência entre STF e STJ",
      detail: `Há trechos de ambos os tribunais sobre o tema. Verifique se há conflito de teses ou se a interpretação do STF prevalece (controle constitucional) sobre a do STJ.`,
      evidence: {
        chunkIds: [...stfChunks.map((c) => c.chunkId), ...stjChunks.map((c) => c.chunkId)],
        normUrns: Array.from(
          new Set([...stfChunks.map((c) => c.norm.urn), ...stjChunks.map((c) => c.norm.urn)]),
        ),
      },
    });
  }

  // 4) Súmula vinculante mencionada na query mas ausente nos chunks
  if (args.intent.wantsSumula) {
    const sumulaKinds: NormKind[] = ["SUMULA_VINCULANTE", "SUMULA_STJ", "SUMULA_STF"];
    const hasSumula = args.chunks.some((c) => sumulaKinds.includes(c.norm.kind));
    if (!hasSumula) {
      out.push({
        id: "sumula-gap",
        severity: "media",
        title: "Súmula esperada mas não recuperada",
        detail: "Sua consulta menciona súmula, mas nenhum verbete sumular foi alcançado pelo retrieval. Considere refinar a busca ou popular o corpus com a súmula relevante.",
        evidence: { chunkIds: [], normUrns: [] },
      });
    }
  }

  // 5) Conflito temporal: norma A é revogada por norma B, ambas presentes
  if (revokes.length > 0) {
    const presentNormIds = new Set(normIds);
    for (const r of revokes) {
      if (r.targetNormId && presentNormIds.has(r.targetNormId) && presentNormIds.has(r.sourceNormId)) {
        const oldNorm = args.chunks.find((c) => c.norm.id === r.targetNormId)!;
        const newNorm = args.chunks.find((c) => c.norm.id === r.sourceNormId)!;
        out.push({
          id: `conflict-temporal:${r.targetNormId}->${r.sourceNormId}`,
          severity: "alta",
          title: "Conflito temporal entre normas recuperadas",
          detail: `${oldNorm.norm.identifier ?? oldNorm.norm.title} foi revogada por ${newNorm.norm.identifier ?? newNorm.norm.title}. Use a norma sucessora para questões posteriores à entrada em vigor.`,
          evidence: { chunkIds: [oldNorm.chunkId, newNorm.chunkId], normUrns: [oldNorm.norm.urn, newNorm.norm.urn] },
        });
      }
    }
  }

  // Dedup por id
  const seen = new Set<string>();
  return out.filter((x) => {
    if (seen.has(x.id)) return false;
    seen.add(x.id);
    return true;
  });
}
