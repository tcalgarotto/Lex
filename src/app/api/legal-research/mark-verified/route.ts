/**
 * P0 — DeepSeek Legal Research Mode (modo temporário).
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/decisions/ADR_DEEPSEEK_LEGAL_RESEARCH_MODE.md
 *
 * Marcação humana de verificação em fonte oficial — não promove jurisprudência
 * candidata automaticamente sem ação explícita e persistência no Case Brain.
 */

import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/session";
import { listPinnedFoundations, markPinnedFoundationVerified } from "@/lib/cases/case-brain";
import {
  enforceLegalResearchRateLimit,
  findCaseInWorkspace,
  logLegalResearchJsonLine,
  scrubPii,
} from "@/lib/legal-research";
import { legalResearchMarkVerifiedBodySchema } from "@/lib/legal-research/request-body";


export async function POST(req: Request) {
  let workspaceId = "";
  let userId = "";
  try {
    const ctx = await getWorkspaceContext();
    workspaceId = ctx.workspaceId;
    userId = ctx.user.id;
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

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400, headers: rl.headers });
  }

  const parsed = legalResearchMarkVerifiedBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload inválido", details: parsed.error.flatten() },
      { status: 400, headers: rl.headers },
    );
  }

  const { caseId, pinnedId: bodyPinnedId, candidateId, officialSourceUrl } = parsed.data;

  const row = await findCaseInWorkspace(workspaceId, caseId);
  if (!row) {
    return NextResponse.json({ error: "Não encontrado." }, { status: 404, headers: rl.headers });
  }

  const pins = await listPinnedFoundations(caseId, workspaceId);
  const resolvedPinnedId =
    bodyPinnedId ??
    pins.find((p) => p.pinnedId === candidateId || p.id === candidateId)?.pinnedId ??
    null;

  if (!resolvedPinnedId) {
    return NextResponse.json({ error: "Não encontrado." }, { status: 404, headers: rl.headers });
  }

  const t0 = Date.now();
  try {
    const r = await markPinnedFoundationVerified(caseId, workspaceId, resolvedPinnedId, userId);
    logLegalResearchJsonLine({
      event: "legal_research.mark_verified",
      workspaceId,
      caseId,
      queryLen: 0,
      durationMs: Date.now() - t0,
      promptVersion: "",
      ok: true,
      extra: {
        candidateId: scrubPii(candidateId ?? resolvedPinnedId),
        pinnedId: scrubPii(resolvedPinnedId),
        kind: parsed.data.kind,
        hasOfficialUrl: Boolean(officialSourceUrl),
      },
    });
    return NextResponse.json(
      { ok: true, pinnedId: r.id, verificationStatus: r.verificationStatus },
      { status: 200, headers: rl.headers },
    );
  } catch (e) {
    const status = typeof e === "object" && e !== null && "status" in e ? Number((e as { status: number }).status) : 500;
    logLegalResearchJsonLine({
      event: "legal_research.mark_verified",
      workspaceId,
      caseId,
      queryLen: 0,
      durationMs: Date.now() - t0,
      promptVersion: "",
      ok: false,
      errorCode: "persist_failed",
      extra: { message: scrubPii(e instanceof Error ? e.message : String(e)) },
    });
    if (status === 404) {
      return NextResponse.json({ error: "Não encontrado." }, { status: 404, headers: rl.headers });
    }
    return NextResponse.json({ error: "Não foi possível registrar a verificação." }, { status: 500, headers: rl.headers });
  }
}
