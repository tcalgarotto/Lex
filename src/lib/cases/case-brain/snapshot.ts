/**
 * P0 — Case Brain pipeline (entrevista → dados → persistência).
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/CASE_BRAIN.md
 */

import { prisma } from "@/lib/prisma";
import type { CaseBrain } from "@/lib/cases/brain-types";
import { listPinnedFoundations } from "./pinned-foundations";
import { computeCaseFingerprint } from "./fingerprint";
import { readEntityMeta } from "./merge-policy";

export type CaseBrainSnapshot = {
  caseId: string;
  workspaceId: string;
  title: string;
  summary: string | null;
  status: string;
  rawInput: string;
  caseFingerprint: string | null;
  brain: CaseBrain | null;
  brainVersion: number;
  pinnedFoundations: Awaited<ReturnType<typeof listPinnedFoundations>>;
  parties: Array<{
    id: string;
    role: string;
    kind: string;
    name: string;
    document: string | null;
    metadataJson: unknown;
    origem: string | null;
    status: string | null;
    lockedByUser: boolean;
  }>;
  facts: Array<{
    id: string;
    ordinal: number;
    text: string;
    category: string | null;
    confidence: number;
    metadataJson: unknown;
    origem: string | null;
    status: string | null;
    lockedByUser: boolean;
  }>;
  claims: Array<{
    id: string;
    ordinal: number;
    kind: string;
    text: string;
    legalBasisUrn: string | null;
    metadataJson: unknown;
    origem: string | null;
    status: string | null;
    lockedByUser: boolean;
  }>;
  risks: Array<{
    id: string;
    kind: string;
    severity: string;
    title: string;
    detail: string;
    metadataJson: unknown;
    origem: string | null;
    status: string | null;
    lockedByUser: boolean;
  }>;
  documents: Array<{
    id: string;
    originalName: string;
    mimeType: string;
    status: string;
    uiStatus: string;
    extractedPreview: string | null;
    errorMessage: string | null;
    updatedAt: string;
  }>;
};

function mapUiDocumentStatus(status: string, hasText: boolean): string {
  if (status === "FAILED") return "FAILED";
  if (status === "UPLOADED") return "PROCESSING";
  if (status === "PARSING" || status === "CHUNKING" || status === "EMBEDDING") return "PROCESSING";
  if (status === "INDEXED" && hasText) return "READY";
  if (status === "INDEXED") return "READY";
  return "PROCESSING";
}

export async function getCaseBrainSnapshot(
  caseId: string,
  workspaceId: string,
): Promise<CaseBrainSnapshot | null> {
  const c = await prisma.case.findFirst({
    where: { id: caseId, workspaceId, deletedAt: null },
    include: {
      parties: { orderBy: { createdAt: "asc" } },
      facts: { orderBy: { ordinal: "asc" } },
      requests: { orderBy: { ordinal: "asc" } },
      risks: { orderBy: { createdAt: "desc" } },
      documents: {
        where: { deletedAt: null },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          originalName: true,
          mimeType: true,
          status: true,
          extractedText: true,
          errorMessage: true,
          updatedAt: true,
        },
      },
    },
  });
  if (!c) return null;
  const meta = (c.metadataJson ?? {}) as Record<string, unknown>;
  const brain = (meta["brain"] as CaseBrain | null) ?? null;
  const brainVersion = typeof meta["brainVersion"] === "number" ? meta["brainVersion"] : brain?.brainVersion ?? 0;
  const caseBrain = (meta["caseBrain"] ?? {}) as Record<string, unknown>;
  const fp =
    (typeof caseBrain["caseFingerprint"] === "string" ? caseBrain["caseFingerprint"] : null) ??
    (await computeCaseFingerprint(caseId, workspaceId));
  const pinned = await listPinnedFoundations(caseId, workspaceId);

  const mapOrig = (m: ReturnType<typeof readEntityMeta>) =>
    (m.origem as string | undefined) ?? (m.origin as string | undefined) ?? (m.source as string | null) ?? null;

  return {
    caseId: c.id,
    workspaceId: c.workspaceId,
    title: c.title,
    summary: c.summary,
    status: c.status,
    rawInput: c.rawInput,
    caseFingerprint: fp,
    brain,
    brainVersion,
    pinnedFoundations: pinned,
    parties: c.parties.map((p) => {
      const m = readEntityMeta(p.metadataJson);
      return {
        id: p.id,
        role: p.role,
        kind: p.kind,
        name: p.name,
        document: p.document,
        metadataJson: p.metadataJson,
        origem: mapOrig(m),
        status: (m.status as string | undefined) ?? null,
        lockedByUser: Boolean(m.lockedByUser),
      };
    }),
    facts: c.facts.map((f) => {
      const m = readEntityMeta(f.metadataJson);
      return {
        id: f.id,
        ordinal: f.ordinal,
        text: f.text,
        category: f.category,
        confidence: f.confidence,
        metadataJson: f.metadataJson,
        origem: mapOrig(m),
        status: (m.status as string | undefined) ?? null,
        lockedByUser: Boolean(m.lockedByUser),
      };
    }),
    claims: c.requests.map((r) => {
      const m = readEntityMeta(r.metadataJson);
      return {
        id: r.id,
        ordinal: r.ordinal,
        kind: r.kind,
        text: r.text,
        legalBasisUrn: r.legalBasisUrn,
        metadataJson: r.metadataJson,
        origem: mapOrig(m),
        status: (m.status as string | undefined) ?? null,
        lockedByUser: Boolean(m.lockedByUser),
      };
    }),
    risks: c.risks.map((r) => {
      const m = readEntityMeta(r.metadataJson);
      return {
        id: r.id,
        kind: r.kind,
        severity: r.severity,
        title: r.title,
        detail: r.detail,
        metadataJson: r.metadataJson,
        origem: mapOrig(m),
        status: (m.status as string | undefined) ?? null,
        lockedByUser: Boolean(m.lockedByUser),
      };
    }),
    documents: c.documents.map((d) => {
      const hasText = Boolean(d.extractedText && d.extractedText.length > 0);
      return {
        id: d.id,
        originalName: d.originalName,
        mimeType: d.mimeType,
        status: d.status,
        uiStatus: mapUiDocumentStatus(d.status, hasText),
        extractedPreview: d.extractedText ? d.extractedText.slice(0, 4000) : null,
        errorMessage: d.errorMessage,
        updatedAt: d.updatedAt.toISOString(),
      };
    }),
  };
}
