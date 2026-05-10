/**
 * P0 — Estratégia e Peças (drafting + review + export).
 * Drafting-guard ativo; jurisprudência candidata não promovida sem confirmação humana.
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/features/CASE_DRAFTING_TAB.md
 *
 * Adapta `@/lib/cases/case-brain` ao contrato esperado por `generate-strategy` / `generate-draft`
 * (ordem workspaceId/caseId + formato de pins compatível com `drafting-guard`).
 */

import type { CaseBrain } from "@/lib/cases/brain-types";
import {
  getCaseBrainSnapshot as loadCaseBrainSnapshot,
} from "@/lib/cases/case-brain/snapshot";
import {
  listPinnedFoundations as listPinnedFromCaseBrain,
} from "@/lib/cases/case-brain/pinned-foundations";
import type { PinnedFoundation } from "@/lib/cases/case-brain/pinned-foundations";
import { markPinnedFoundationVerified as markVerifiedCaseBrain } from "@/lib/cases/case-brain/pinned-foundations";
import { buildCaseContext } from "@/lib/cases/context";
import type { PinnedFoundationListItem, PinnedJurisprudenceListItem } from "@/lib/cases/drafting/drafting-types";
import type { LegalFoundationCandidate, JurisprudenceCandidate } from "@/lib/legal-research/types";

const ASSISTED_PIN_CHUNK = "ASSISTED_LEGAL_RESEARCH";

export type CaseBrainSnapshot = {
  brain: CaseBrain | null;
  parties: Array<{ id: string; role: string; name: string }>;
  facts: Array<{ id: string; text: string }>;
  requests: Array<{ kind: string; text: string }>;
  risks: Array<{ title: string; detail: string }>;
  documents: Array<{ id: string; originalName: string }>;
};

function isJurisprudencePin(p: PinnedFoundation): p is JurisprudenceCandidate & PinnedFoundation {
  if (p.kind === "jurisprudence") return true;
  return "court" in p && typeof (p as JurisprudenceCandidate).court === "string";
}

function mapFoundationPinsToDraftingList(pins: PinnedFoundation[]): PinnedFoundationListItem[] {
  const out: PinnedFoundationListItem[] = [];
  for (const p of pins) {
    if (isJurisprudencePin(p)) continue;
    const f = p as LegalFoundationCandidate & { pinnedId: string };
    out.push({
      id: f.pinnedId,
      chunkId: ASSISTED_PIN_CHUNK,
      normUrn: null,
      articleRef: f.article ?? null,
      excerpt: f.excerpt,
      verificationStatus: f.verificationStatus,
      title: f.title,
      citation: f.citation,
    });
  }
  return out;
}

export async function getCaseBrainSnapshot(
  workspaceId: string,
  caseId: string,
): Promise<CaseBrainSnapshot | null> {
  const snap = await loadCaseBrainSnapshot(caseId, workspaceId);
  if (!snap) return null;
  return {
    brain: snap.brain,
    parties: snap.parties.map((p) => ({ id: p.id, role: p.role, name: p.name })),
    facts: snap.facts.map((f) => ({ id: f.id, text: f.text })),
    requests: snap.claims.map((c) => ({ kind: c.kind, text: c.text })),
    risks: snap.risks.map((r) => ({ title: r.title, detail: r.detail })),
    documents: snap.documents.map((d) => ({ id: d.id, originalName: d.originalName })),
  };
}

export async function listPinnedFoundations(
  workspaceId: string,
  caseId: string,
): Promise<PinnedFoundationListItem[]> {
  const pins = await listPinnedFromCaseBrain(caseId, workspaceId);
  return mapFoundationPinsToDraftingList(pins);
}

/**
 * Jurisprudências candidatas ligadas ao caso (pins tipo jurisprudência + metadado legado).
 * TODO: alinhar fonte única com resultados da pesquisa assistida quando houver sync automático.
 */
export async function listPinnedJurisprudenceCandidates(
  workspaceId: string,
  caseId: string,
): Promise<PinnedJurisprudenceListItem[]> {
  const ctx = await buildCaseContext({ workspaceId, caseId });
  if (!ctx) return [];

  const pins = await listPinnedFromCaseBrain(caseId, workspaceId);
  const fromPins: PinnedJurisprudenceListItem[] = pins.filter(isJurisprudencePin).map((j) => ({
    id: j.pinnedId,
    court: j.court,
    title: j.title,
    processNumber: j.processNumber,
    verificationStatus: j.verificationStatus,
    excerpt: j.excerpt,
  }));

  const meta = (ctx.case.metadataJson ?? {}) as Record<string, unknown>;
  const raw = meta["jurisprudenceCandidates"];
  const fromMeta: PinnedJurisprudenceListItem[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const id = typeof o["id"] === "string" ? o["id"] : crypto.randomUUID();
      const court = typeof o["court"] === "string" ? o["court"] : "Tribunal a confirmar";
      const title = typeof o["title"] === "string" ? o["title"] : "Julgado candidato";
      const processNumber = typeof o["processNumber"] === "string" ? o["processNumber"] : undefined;
      const verificationStatus =
        typeof o["verificationStatus"] === "string" ? o["verificationStatus"] : "AI_RECOMMENDED_UNVERIFIED";
      const excerpt = typeof o["excerpt"] === "string" ? o["excerpt"] : undefined;
      fromMeta.push({ id, court, title, processNumber, verificationStatus, excerpt });
    }
  }

  const seen = new Set<string>();
  const merged: PinnedJurisprudenceListItem[] = [];
  for (const row of [...fromPins, ...fromMeta]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    merged.push(row);
  }
  return merged;
}

export async function markPinnedFoundationVerified(
  workspaceId: string,
  caseId: string,
  foundationId: string,
): Promise<boolean> {
  try {
    await markVerifiedCaseBrain(caseId, workspaceId, foundationId, "user");
    return true;
  } catch {
    return false;
  }
}
