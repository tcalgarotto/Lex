/**
 * P0 — Case Brain pipeline (entrevista → dados → persistência).
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/CASE_BRAIN.md
 */

import type { CaseEntityMetadata } from "./constants";

export function readEntityMeta(raw: unknown): CaseEntityMetadata {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  return {
    ...o,
    origem: typeof o["origem"] === "string" ? o["origem"] : undefined,
    origin: typeof o["origin"] === "string" ? o["origin"] : undefined,
    source: typeof o["source"] === "string" ? o["source"] : undefined,
    status: typeof o["status"] === "string" ? o["status"] : undefined,
    confidence: typeof o["confidence"] === "number" ? o["confidence"] : undefined,
    lockedByUser: Boolean(o["lockedByUser"]),
    sourceText: typeof o["sourceText"] === "string" ? o["sourceText"] : undefined,
    versionHistory: Array.isArray(o["versionHistory"]) ? (o["versionHistory"] as CaseEntityMetadata["versionHistory"]) : undefined,
  };
}

export function isLockedAgainstAi(meta: CaseEntityMetadata): boolean {
  if (meta.lockedByUser) return true;
  const st = String(meta.status ?? "").toLowerCase();
  if (st === "confirmado" || st === "manual") return true;
  return false;
}

export function normalizeTextKey(s: string, maxLen = 200): string {
  return s.trim().toLowerCase().slice(0, maxLen);
}

export function appendVersionHistory(
  meta: CaseEntityMetadata,
  userId: string | undefined,
  patch: Record<string, unknown>,
  max = 20,
): CaseEntityMetadata {
  const hist = [...(meta.versionHistory ?? [])];
  hist.push({
    at: new Date().toISOString(),
    ...(userId ? { userId } : {}),
    patch,
  });
  return { ...meta, versionHistory: hist.slice(-max) };
}
