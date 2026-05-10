/**
 * P0 — Case Brain pipeline (entrevista → dados → persistência).
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/CASE_BRAIN.md
 */

import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { mergeCaseMetadataJson } from "./case-metadata-merge";

/**
 * Hash estável do estado relacional do caso (partes, fatos, pedidos, riscos, brainVersion).
 * Não inclui texto bruto completo — apenas contagens, ordinais e ids para correlação.
 */
export async function computeCaseFingerprint(caseId: string, workspaceId: string): Promise<string | null> {
  const c = await prisma.case.findFirst({
    where: { id: caseId, workspaceId },
    select: {
      id: true,
      updatedAt: true,
      metadataJson: true,
      parties: { select: { id: true, name: true, role: true, metadataJson: true } },
      facts: { select: { id: true, ordinal: true, text: true, metadataJson: true } },
      requests: { select: { id: true, ordinal: true, text: true, metadataJson: true } },
      risks: { select: { id: true, title: true, metadataJson: true } },
    },
  });
  if (!c) return null;
  const meta = (c.metadataJson ?? {}) as Record<string, unknown>;
  const brainVersion = typeof meta["brainVersion"] === "number" ? meta["brainVersion"] : 0;
  const payload = {
    caseId: c.id,
    u: c.updatedAt.toISOString(),
    brainVersion,
    parties: c.parties.map((p) => ({
      id: p.id,
      role: p.role,
      n: p.name.slice(0, 80),
      m: fingerprintMetaSlice(p.metadataJson),
    })),
    facts: c.facts.map((f) => ({
      id: f.id,
      o: f.ordinal,
      t: f.text.slice(0, 120),
      m: fingerprintMetaSlice(f.metadataJson),
    })),
    requests: c.requests.map((r) => ({
      id: r.id,
      o: r.ordinal,
      t: r.text.slice(0, 120),
      m: fingerprintMetaSlice(r.metadataJson),
    })),
    risks: c.risks.map((r) => ({
      id: r.id,
      t: r.title.slice(0, 120),
      m: fingerprintMetaSlice(r.metadataJson),
    })),
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 32);
}

/** Atualiza apenas `caseBrain.caseFingerprint` após mutação em entidades do caso. */
export async function touchCaseBrainFingerprintAfterMutation(
  caseId: string,
  workspaceId: string,
): Promise<void> {
  const fp = await computeCaseFingerprint(caseId, workspaceId);
  if (!fp) return;
  const c = await prisma.case.findFirst({
    where: { id: caseId, workspaceId },
    select: { metadataJson: true },
  });
  if (!c) return;
  const meta = (c.metadataJson ?? {}) as Record<string, unknown>;
  const next = mergeCaseMetadataJson(meta, {
    caseBrain: { ...(meta["caseBrain"] as object), caseFingerprint: fp },
  });
  await prisma.case.update({
    where: { id: caseId },
    data: { metadataJson: next as Prisma.InputJsonValue },
  });
}

function fingerprintMetaSlice(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  return {
    locked: Boolean(o["lockedByUser"]),
    st: typeof o["status"] === "string" ? o["status"] : "",
    or: typeof o["origem"] === "string" ? o["origem"] : typeof o["origin"] === "string" ? o["origin"] : "",
  };
}
