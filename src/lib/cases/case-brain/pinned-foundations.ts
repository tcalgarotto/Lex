/**
 * P0 — Case Brain pipeline (entrevista → dados → persistência).
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/CASE_BRAIN.md
 */

import { Prisma } from "@prisma/client";
import { nanoid } from "nanoid";
import type { JurisprudenceCandidate, LegalFoundationCandidate } from "@/lib/legal-research/types";
import { prisma } from "@/lib/prisma";
import { mergeCaseMetadataJson } from "./case-metadata-merge";
import { computeCaseFingerprint } from "./fingerprint";
import { recordCaseMutationActivity } from "./activity-log";

export type PinnedFoundationKind = "foundation" | "jurisprudence";

export type PinnedFoundation = (LegalFoundationCandidate | JurisprudenceCandidate) & {
  pinnedId: string;
  kind: PinnedFoundationKind;
  pinnedAt: string;
  pinnedBy: string;
  verifiedAt?: string;
  verifiedBy?: string;
};

function isJurisprudence(c: LegalFoundationCandidate | JurisprudenceCandidate): c is JurisprudenceCandidate {
  return "court" in c && typeof (c as JurisprudenceCandidate).court === "string";
}

/** `CaseLegalSource.chunkId` sintético para pins da pesquisa assistida (sem corpus indexado). */
export function assistedPinChunkId(kind: PinnedFoundationKind, pinnedId: string): string {
  return kind === "jurisprudence" ? `lex-assisted-juris:${pinnedId}` : `lex-assisted-pin:${pinnedId}`;
}

function readPinnedList(meta: Record<string, unknown>): PinnedFoundation[] {
  const cb = (meta["caseBrain"] ?? {}) as Record<string, unknown>;
  const raw = cb["pinnedFoundations"];
  if (!Array.isArray(raw)) return [];
  return raw.filter((x) => x && typeof x === "object") as PinnedFoundation[];
}

export async function listPinnedFoundations(
  caseId: string,
  workspaceId: string,
): Promise<PinnedFoundation[]> {
  const c = await prisma.case.findFirst({
    where: { id: caseId, workspaceId },
    select: { metadataJson: true },
  });
  if (!c) return [];
  return readPinnedList((c.metadataJson ?? {}) as Record<string, unknown>);
}

export async function addPinnedFoundationToCase(
  caseId: string,
  workspaceId: string,
  candidate: LegalFoundationCandidate | JurisprudenceCandidate,
  pinnedByUserId?: string,
): Promise<{ id: string; status: "pinned" | "already_pinned" }> {
  const c = await prisma.case.findFirst({
    where: { id: caseId, workspaceId },
    select: { id: true, metadataJson: true },
  });
  if (!c) {
    throw Object.assign(new Error("Caso não encontrado"), { status: 404 });
  }
  const meta = (c.metadataJson ?? {}) as Record<string, unknown>;
  const list = readPinnedList(meta);
  const dup = list.find((p) => p.id === candidate.id);
  if (dup) {
    return { id: dup.pinnedId, status: "already_pinned" };
  }
  const pinnedId = nanoid();
  const kind: PinnedFoundationKind = isJurisprudence(candidate) ? "jurisprudence" : "foundation";
  const pinnedStatus =
    pinnedByUserId && pinnedByUserId !== "system" ? ("USER_PINNED" as const) : candidate.verificationStatus;
  const entry = {
    ...candidate,
    verificationStatus: pinnedStatus,
    pinnedId,
    kind,
    pinnedAt: new Date().toISOString(),
    pinnedBy: pinnedByUserId ?? "system",
  } as PinnedFoundation;
  const nextList = [...list, entry];
  const fp = await computeCaseFingerprint(caseId, workspaceId);
  const nextMeta = mergeCaseMetadataJson(meta, {
    caseBrain: {
      ...(meta["caseBrain"] as object),
      pinnedFoundations: nextList,
      caseFingerprint: fp,
    },
  });
  await prisma.case.update({
    where: { id: caseId },
    data: { metadataJson: nextMeta as Prisma.InputJsonValue },
  });

  const chunkId = assistedPinChunkId(kind, pinnedId);
  const excerpt =
    kind === "jurisprudence"
      ? `${(entry as JurisprudenceCandidate).title}\n${(entry as JurisprudenceCandidate).summary || (entry as JurisprudenceCandidate).excerpt || ""}`.slice(0, 8000)
      : (entry as LegalFoundationCandidate).excerpt;
  const articleRef =
    kind === "jurisprudence"
      ? [(entry as JurisprudenceCandidate).court, (entry as JurisprudenceCandidate).processNumber]
          .filter(Boolean)
          .join(" · ") || "Jurisprudência fixada"
      : (entry as LegalFoundationCandidate).article ?? (entry as LegalFoundationCandidate).citation;
  try {
    await prisma.caseLegalSource.upsert({
      where: { caseId_chunkId: { caseId, chunkId } },
      create: {
        caseId,
        chunkId,
        excerpt: excerpt.slice(0, 20_000),
        articleRef: articleRef?.slice(0, 500) ?? undefined,
        query: "Pesquisa assistida (Lex AI) — fixado no caso",
        pinnedById: pinnedByUserId ?? undefined,
      },
      update: {
        excerpt: excerpt.slice(0, 20_000),
        articleRef: articleRef?.slice(0, 500) ?? undefined,
        query: "Pesquisa assistida (Lex AI) — fixado no caso",
        pinnedById: pinnedByUserId ?? undefined,
      },
    });
  } catch {
    /* não bloqueia pin no Case Brain se a linha espelho falhar */
  }

  await recordCaseMutationActivity({
    workspaceId,
    kind: "case.pinned_foundation",
    title: "Fundamento jurídico fixado no caso",
    meta: { caseId, pinnedId, candidateId: candidate.id },
  });
  return { id: pinnedId, status: "pinned" };
}

export async function removePinnedFoundation(
  caseId: string,
  workspaceId: string,
  pinnedId: string,
): Promise<void> {
  const c = await prisma.case.findFirst({
    where: { id: caseId, workspaceId },
    select: { metadataJson: true },
  });
  if (!c) {
    throw Object.assign(new Error("Caso não encontrado"), { status: 404 });
  }
  const meta = (c.metadataJson ?? {}) as Record<string, unknown>;
  const fullList = readPinnedList(meta);
  const removed = fullList.find((p) => p.pinnedId === pinnedId);
  const list = fullList.filter((p) => p.pinnedId !== pinnedId);
  const fp = await computeCaseFingerprint(caseId, workspaceId);
  const nextMeta = mergeCaseMetadataJson(meta, {
    caseBrain: {
      ...(meta["caseBrain"] as object),
      pinnedFoundations: list,
      caseFingerprint: fp,
    },
  });
  await prisma.case.update({
    where: { id: caseId },
    data: { metadataJson: nextMeta as Prisma.InputJsonValue },
  });

  if (removed) {
    const cid = assistedPinChunkId(removed.kind, pinnedId);
    await prisma.caseLegalSource.deleteMany({ where: { caseId, chunkId: cid } });
  }
}

export async function markPinnedFoundationVerified(
  caseId: string,
  workspaceId: string,
  pinnedId: string,
  verifiedBy: string,
  opts?: { officialSourceUrl?: string },
): Promise<{ id: string; verificationStatus: string }> {
  const c = await prisma.case.findFirst({
    where: { id: caseId, workspaceId },
    select: { metadataJson: true },
  });
  if (!c) {
    throw Object.assign(new Error("Caso não encontrado"), { status: 404 });
  }
  const meta = (c.metadataJson ?? {}) as Record<string, unknown>;
  const list = readPinnedList(meta);
  const idx = list.findIndex((p) => p.pinnedId === pinnedId);
  if (idx === -1) {
    throw Object.assign(new Error("Pin não encontrado"), { status: 404 });
  }
  const cur = list[idx]!;
  const now = new Date().toISOString();
  const official = Boolean(opts?.officialSourceUrl?.trim());
  const nextStatus = official ? "VERIFIED_BY_OFFICIAL_SOURCE" : "USER_VERIFIED";
  const updated: PinnedFoundation = {
    ...cur,
    verifiedAt: now,
    verifiedBy,
    verificationStatus: nextStatus,
    ...(official && opts?.officialSourceUrl
      ? { sourceUrl: opts.officialSourceUrl.trim() }
      : {}),
  };
  const nextList = [...list];
  nextList[idx] = updated;
  const fp = await computeCaseFingerprint(caseId, workspaceId);
  const nextMeta = mergeCaseMetadataJson(meta, {
    caseBrain: {
      ...(meta["caseBrain"] as object),
      pinnedFoundations: nextList,
      caseFingerprint: fp,
    },
  });
  await prisma.case.update({
    where: { id: caseId },
    data: { metadataJson: nextMeta as Prisma.InputJsonValue },
  });
  return { id: pinnedId, verificationStatus: String(updated.verificationStatus ?? "verified") };
}
