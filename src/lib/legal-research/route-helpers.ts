/**
 * P0 — DeepSeek Legal Research Mode (modo temporário).
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/decisions/ADR_DEEPSEEK_LEGAL_RESEARCH_MODE.md
 */

import { rateLimit, rateLimitHeaders, rateLimitHttpStatus } from "@/lib/rate-limit";
import { prisma } from "@/lib/prisma";
import type { LegalResearchRequest, LegalResearchResponse } from "./types";

export function isDeepseekLegalResearchDisabled(): boolean {
  const v = process.env["DEEPSEEK_LEGAL_RESEARCH_ENABLED"]?.trim().toLowerCase();
  return v === "0" || v === "false" || v === "no";
}

export function withHumanReviewMetadata(
  res: LegalResearchResponse,
): LegalResearchResponse {
  const raw = process.env["LEGAL_RESEARCH_REQUIRE_HUMAN_REVIEW"]?.trim().toLowerCase();
  const legalResearchHumanReviewRequired = raw !== "false" && raw !== "0" && raw !== "no";
  return {
    ...res,
    providerMetadata: {
      ...res.providerMetadata,
      legalResearchHumanReviewRequired,
    },
  };
}

export function rateLimitPerMinute(): number {
  const raw = process.env["LEGAL_RESEARCH_RATE_LIMIT_PER_MIN"];
  const n = raw ? parseInt(raw, 10) : 30;
  return Number.isFinite(n) && n > 0 ? n : 30;
}

export async function enforceLegalResearchRateLimit(
  workspaceId: string,
): Promise<
  | { ok: true; headers: Record<string, string> }
  | { ok: false; headers: Record<string, string>; status: 429 | 503 }
> {
  const limit = rateLimitPerMinute();
  const result = await rateLimit({
    key: `legal-research:${workspaceId}`,
    limit,
    windowSeconds: 60,
    tier: "expensive",
  });
  const headers = rateLimitHeaders(result);
  if (!result.allowed) {
    return { ok: false, headers, status: rateLimitHttpStatus(result) as 429 | 503 };
  }
  return { ok: true, headers };
}

/** Garante que o caso exista neste workspace; senão `null` (tratar como 404). */
export async function findCaseInWorkspace(
  workspaceId: string,
  caseId: string,
): Promise<{ id: string } | null> {
  return prisma.case.findFirst({
    where: { id: caseId, workspaceId, deletedAt: null },
    select: { id: true },
  });
}

export function mergeLegalResearchRequest(
  workspaceId: string,
  partial: Omit<LegalResearchRequest, "workspaceId">,
): LegalResearchRequest {
  return { ...partial, workspaceId };
}
