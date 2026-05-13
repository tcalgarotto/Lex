/**
 * Carga consolidada do caso (uma request RSC ou GET /bootstrap).
 * Evita fan-out de várias rotas `/api/cases/[id]/…` na abertura do caso.
 */

import type {
  CaseAnnotation,
  CaseComment,
  CaseDraft,
  CaseLegalSource,
  DraftApproval,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { listPinnedJurisprudenceCandidates } from "@/lib/cases/drafting/case-brain-shim";
import type { PinnedJurisprudenceListItem } from "@/lib/cases/drafting/drafting-types";
import { loadCaseChecklistStateForBootstrap, type CaseChecklistStatePayload } from "@/lib/cases/case-checklist-state";
import { listPinnedFoundations } from "@/lib/cases/case-brain/pinned-foundations";

export type CaseDraftingBootstrapSlice = {
  casePartiesFacts: {
    parties: { role: string }[];
    facts: { id: string }[];
  };
  readiness: unknown;
  draftingStrategy: unknown;
  approved: boolean;
  jurisprudenceCandidates: PinnedJurisprudenceListItem[];
  legalSources: CaseLegalSource[];
  drafts: CaseDraft[];
  draftingGuards: {
    hasUnverifiedFoundationPin: boolean;
    hasUnverifiedJuris: boolean;
  };
};

export type CaseBootstrapPayload = {
  collab: {
    comments: CaseComment[];
    annotations: CaseAnnotation[];
    approvals: DraftApproval[];
  };
  checklist: CaseChecklistStatePayload;
  drafting: CaseDraftingBootstrapSlice;
};

function strategySliceFromMetadata(metadataJson: unknown, juris: PinnedJurisprudenceListItem[]) {
  const meta = (metadataJson ?? {}) as Record<string, unknown>;
  const readiness =
    meta["brain"] &&
    typeof meta["brain"] === "object" &&
    (meta["brain"] as { proceduralReadiness?: unknown }).proceduralReadiness
      ? (meta["brain"] as { proceduralReadiness: unknown }).proceduralReadiness
      : null;

  return {
    readiness,
    draftingStrategy: meta["draftingStrategy"] ?? null,
    approved: Boolean(meta["draftingStrategyApproved"]),
    jurisprudenceCandidates: juris,
  };
}

/**
 * Carrega dados iniciais do caso em paralelo, após confirmar `caseId` no `workspaceId`.
 * Retorna `null` se o caso não pertencer ao workspace.
 */
export async function gatherCaseBootstrap(
  workspaceId: string,
  caseId: string,
  _userId: string,
): Promise<CaseBootstrapPayload | null> {
  const gate = await prisma.case.findFirst({
    where: { id: caseId, workspaceId },
    select: { id: true },
  });
  if (!gate) return null;

  const [comments, annotations, approvals, checklist, caseRow, legalSources, drafts, jurisprudenceCandidates, brainPins] =
    await Promise.all([
      prisma.caseComment.findMany({
        where: { caseId },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.caseAnnotation.findMany({
        where: { caseId },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      prisma.draftApproval.findMany({
        where: { caseId },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      loadCaseChecklistStateForBootstrap(workspaceId, caseId, null),
      prisma.case.findFirst({
        where: { id: caseId, workspaceId },
        select: {
          metadataJson: true,
          parties: { select: { role: true } },
          facts: { select: { id: true }, take: 500 },
        },
      }),
      prisma.caseLegalSource.findMany({
        where: { caseId },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.caseDraft.findMany({
        where: { caseId },
        orderBy: { version: "desc" },
      }),
      listPinnedJurisprudenceCandidates(workspaceId, caseId),
      listPinnedFoundations(caseId, workspaceId),
    ]);

  if (!checklist || !caseRow) return null;

  const strategy = strategySliceFromMetadata(caseRow.metadataJson, jurisprudenceCandidates);

  const hasUnverifiedFoundationPin = brainPins.some(
    (p) => p.kind === "foundation" && p.verificationStatus === "AI_RECOMMENDED_UNVERIFIED",
  );
  const hasUnverifiedJuris = jurisprudenceCandidates.some(
    (j) => j.verificationStatus === "AI_RECOMMENDED_UNVERIFIED",
  );

  const drafting: CaseDraftingBootstrapSlice = {
    casePartiesFacts: {
      parties: caseRow.parties,
      facts: caseRow.facts,
    },
    readiness: strategy.readiness,
    draftingStrategy: strategy.draftingStrategy,
    approved: strategy.approved,
    jurisprudenceCandidates: strategy.jurisprudenceCandidates,
    legalSources,
    drafts,
    draftingGuards: {
      hasUnverifiedFoundationPin,
      hasUnverifiedJuris,
    },
  };

  return {
    collab: { comments, annotations, approvals },
    checklist,
    drafting,
  };
}
