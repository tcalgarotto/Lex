/**
 * P0 — DeepSeek Legal Research Mode (modo temporário).
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/decisions/ADR_DEEPSEEK_LEGAL_RESEARCH_MODE.md
 */

import { createHash } from "node:crypto";
import type { LegalResearchRequest, LegalResearchResponse } from "./types";

type CacheEntry = { expiresAt: number; value: LegalResearchResponse };

const memory = new Map<string, CacheEntry>();

function cacheDisabled(): boolean {
  const v = process.env["LEGAL_RESEARCH_CACHE_DISABLED"]?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function ttlMs(): number {
  const raw = process.env["LEGAL_RESEARCH_CACHE_TTL_MS"];
  const n = raw ? parseInt(raw, 10) : 600_000;
  return Number.isFinite(n) && n > 0 ? n : 600_000;
}

export function legalResearchRequestHash(req: LegalResearchRequest): string {
  const stable = JSON.stringify({
    workspaceId: req.workspaceId,
    caseId: req.caseId ?? null,
    query: req.query,
    caseBrain: req.caseBrain ?? null,
    area: req.area ?? null,
    jurisdiction: req.jurisdiction ?? null,
    courts: req.courts ?? null,
    dateRange: req.dateRange ?? null,
    resultTypes: [...req.resultTypes].sort(),
    maxResults: req.maxResults,
    language: req.language,
  });
  return createHash("sha256").update(stable).digest("hex");
}

export function getCachedLegalResearch(
  mode: "search" | "recommend",
  hash: string,
): LegalResearchResponse | null {
  if (cacheDisabled()) return null;
  const key = `${mode}:${hash}`;
  const row = memory.get(key);
  if (!row || row.expiresAt <= Date.now()) {
    if (row) memory.delete(key);
    return null;
  }
  return row.value;
}

export function setCachedLegalResearch(
  mode: "search" | "recommend",
  hash: string,
  value: LegalResearchResponse,
): void {
  if (cacheDisabled()) return;
  const key = `${mode}:${hash}`;
  memory.set(key, { value, expiresAt: Date.now() + ttlMs() });
}

/** Testes / diagnóstico — não usar em produção salvo necessidade. */
export function _clearLegalResearchCacheForTests(): void {
  memory.clear();
}
