/**
 * `buildCaseContext` — único ponto de leitura do caso para todos os
 * workflows (drafting, review, strategy, brain). Centraliza joins,
 * casts JSON, e devolve estrutura previsível para a camada de geração.
 *
 * Nada de regras de negócio aqui — apenas leitura agregada.
 */

import type { Prisma } from "@prisma/client";
import { getCaseById } from "./repository";
import type { CaseBrain } from "./brain-types";
import type { BrainInputDoc } from "./brain";

export type CaseContext = {
  case: NonNullable<Awaited<ReturnType<typeof getCaseById>>>;
  brain: CaseBrain | null;
  parties: NonNullable<Awaited<ReturnType<typeof getCaseById>>>["parties"];
  facts: NonNullable<Awaited<ReturnType<typeof getCaseById>>>["facts"];
  requests: NonNullable<Awaited<ReturnType<typeof getCaseById>>>["requests"];
  risks: NonNullable<Awaited<ReturnType<typeof getCaseById>>>["risks"];
  documents: BrainInputDoc[];
  pinnedSources: NonNullable<Awaited<ReturnType<typeof getCaseById>>>["legalSources"];
  drafts: NonNullable<Awaited<ReturnType<typeof getCaseById>>>["drafts"];
  reviews: NonNullable<Awaited<ReturnType<typeof getCaseById>>>["reviews"];
  timeline: NonNullable<Awaited<ReturnType<typeof getCaseById>>>["timeline"];
  inconsistencies: { kind: string; description: string; evidence: string }[];
  /** Estratégia consolidada (Case.metadataJson.strategy), se existir. */
  strategy: unknown | null;
};

export async function buildCaseContext(args: {
  workspaceId: string;
  caseId: string;
}): Promise<CaseContext | null> {
  const c = await getCaseById(args.workspaceId, args.caseId);
  if (!c) return null;

  // Carrega texto extraído dos documentos (evita carregar tudo do GET do caso).
  const docTexts =
    c.documents.length > 0
      ? await fetchDocumentTexts(c.documents.map((d) => d.id))
      : [];

  const meta = (c.metadataJson ?? {}) as Record<string, unknown>;
  const brain = readBrain(meta);
  const strategy = (meta["strategy"] as unknown) ?? null;

  return {
    case: c,
    brain,
    parties: c.parties,
    facts: c.facts,
    requests: c.requests,
    risks: c.risks,
    documents: docTexts,
    pinnedSources: c.legalSources,
    drafts: c.drafts,
    reviews: c.reviews,
    timeline: c.timeline,
    inconsistencies: brain?.inconsistencies ?? [],
    strategy,
  };
}

function readBrain(meta: Record<string, unknown>): CaseBrain | null {
  const b = meta["brain"];
  if (!b || typeof b !== "object") return null;
  // Validação leve — não invalidamos o brain inteiro por campo faltante,
  // mas garantimos os campos críticos.
  const x = b as Partial<CaseBrain>;
  if (typeof x.title !== "string") return null;
  return x as CaseBrain;
}

async function fetchDocumentTexts(documentIds: string[]): Promise<BrainInputDoc[]> {
  const { prisma } = await import("@/lib/prisma");
  const where: Prisma.DocumentWhereInput = { id: { in: documentIds } };
  const docs = await prisma.document.findMany({
    where,
    select: { id: true, originalName: true, extractedText: true },
  });
  return docs.map((d) => ({
    id: d.id,
    originalName: d.originalName,
    text: (d.extractedText ?? "").slice(0, 60_000),
  }));
}
