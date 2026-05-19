/**
 * P0 — DeepSeek Legal Research Mode (modo temporário).
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/decisions/ADR_DEEPSEEK_LEGAL_RESEARCH_MODE.md
 */

import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/session";
import {
  enforceLegalResearchRateLimit,
  findCaseInWorkspace,
  getCachedLegalResearch,
  getLegalResearchProvider,
  isDeepseekLegalResearchDisabled,
  legalResearchRequestHash,
  logLegalResearchJsonLine,
  setCachedLegalResearch,
  withHumanReviewMetadata,
} from "@/lib/legal-research";
import { legalResearchRecommendBodySchema } from "@/lib/legal-research/request-body";
import type { LegalResearchRequest, LegalResearchResponse } from "@/lib/legal-research/types";
import {
  buildCaseTaskContext,
  formatCaseTaskContextForPrompt,
} from "@/lib/cases/intake/case-intake-context";


export async function POST(req: Request) {
  let workspaceId = "";
  try {
    ({ workspaceId } = await getWorkspaceContext());
  } catch {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const rl = await enforceLegalResearchRateLimit(workspaceId);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Muitas requisições. Aguarde um minuto." },
      { status: rl.status, headers: rl.headers },
    );
  }

  const providerId = process.env["LEGAL_RESEARCH_PROVIDER"]?.trim().toLowerCase() || "deepseek";
  if (providerId === "deepseek" && isDeepseekLegalResearchDisabled()) {
    return NextResponse.json(
      { error: "Pesquisa assistida temporariamente desligada." },
      { status: 503, headers: rl.headers },
    );
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400, headers: rl.headers });
  }

  const parsed = legalResearchRecommendBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload inválido", details: parsed.error.flatten() },
      { status: 400, headers: rl.headers },
    );
  }

  if (parsed.data.workspaceId && parsed.data.workspaceId !== workspaceId) {
    return NextResponse.json({ error: "Workspace inválido." }, { status: 403, headers: rl.headers });
  }

  const row = await findCaseInWorkspace(workspaceId, parsed.data.caseId);
  if (!row) {
    return NextResponse.json({ error: "Não encontrado." }, { status: 404, headers: rl.headers });
  }

  let caseBrainText = parsed.data.caseBrain?.trim() ?? "";
  if (!caseBrainText) {
    const taskCtx = await buildCaseTaskContext(parsed.data.caseId, workspaceId, "legal_research");
    if (taskCtx) {
      caseBrainText = formatCaseTaskContextForPrompt(taskCtx);
    }
  }

  const { workspaceId: _clientWorkspace, ...rest } = parsed.data;
  void _clientWorkspace;
  const full: LegalResearchRequest = { ...rest, workspaceId, caseBrain: caseBrainText || rest.caseBrain };

  const hash = legalResearchRequestHash(full);
  const cached = getCachedLegalResearch("recommend", hash);
  if (cached) {
    const out = withHumanReviewMetadata({
      ...cached,
      providerMetadata: { ...cached.providerMetadata, cacheHit: true },
    });
    logLegalResearchJsonLine({
      event: "legal_research.recommend",
      workspaceId,
      caseId: full.caseId,
      queryLen: full.query.length,
      durationMs: 0,
      promptVersion: String(out.providerMetadata["promptVersion"] ?? ""),
      ok: true,
      extra: { cacheHit: true },
    });
    return NextResponse.json(out, { headers: rl.headers });
  }

  const t0 = Date.now();
  let out: LegalResearchResponse;
  try {
    out = await getLegalResearchProvider().recommendForCase(full);
  } catch {
    logLegalResearchJsonLine({
      event: "legal_research.recommend",
      workspaceId,
      caseId: full.caseId,
      queryLen: full.query.length,
      durationMs: Date.now() - t0,
      promptVersion: "",
      ok: false,
      errorCode: "provider_exception",
    });
    return NextResponse.json({ error: "Erro interno na pesquisa." }, { status: 500, headers: rl.headers });
  }

  setCachedLegalResearch("recommend", hash, out);
  const body = withHumanReviewMetadata(out);

  logLegalResearchJsonLine({
    event: "legal_research.recommend",
    workspaceId,
    caseId: full.caseId,
    queryLen: full.query.length,
    durationMs: Date.now() - t0,
    model: typeof body.providerMetadata["model"] === "string" ? body.providerMetadata["model"] : undefined,
    promptTokens:
      typeof body.providerMetadata["promptTokens"] === "number"
        ? body.providerMetadata["promptTokens"]
        : undefined,
    completionTokens:
      typeof body.providerMetadata["completionTokens"] === "number"
        ? body.providerMetadata["completionTokens"]
        : undefined,
    promptVersion: String(body.providerMetadata["promptVersion"] ?? ""),
    ok: !body.providerMetadata["parseError"] && !body.providerMetadata["upstreamError"],
    extra: {
      provider: body.providerMetadata["provider"],
    },
  });

  return NextResponse.json(body, { headers: rl.headers });
}
