/**
 * P0 — DeepSeek Legal Research Mode (modo temporário).
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/decisions/ADR_DEEPSEEK_LEGAL_RESEARCH_MODE.md
 */

import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/session";
import { addPinnedFoundationToCase } from "@/lib/cases/case-brain";
import {
  enforceLegalResearchRateLimit,
  findCaseInWorkspace,
  logLegalResearchJsonLine,
  scrubPii,
} from "@/lib/legal-research";
import { legalResearchPinBodySchema } from "@/lib/legal-research/request-body";
import type { JurisprudenceCandidate, LegalFoundationCandidate } from "@/lib/legal-research/types";


function coerceFoundation(raw: unknown): LegalFoundationCandidate | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o["id"] !== "string" || typeof o["title"] !== "string" || typeof o["excerpt"] !== "string") return null;
  const typeRaw = o["type"];
  const type =
    typeRaw === "LAW" ||
    typeRaw === "CONSTITUTION" ||
    typeRaw === "CODE" ||
    typeRaw === "STATUTE" ||
    typeRaw === "PRINCIPLE"
      ? typeRaw
      : "LAW";
  const vs = o["verificationStatus"];
  const verificationStatus =
    vs === "AI_RECOMMENDED_UNVERIFIED" ||
    vs === "USER_PINNED" ||
    vs === "USER_VERIFIED" ||
    vs === "VERIFIED_BY_INTERNAL_RAG" ||
    vs === "VERIFIED_BY_OFFICIAL_SOURCE"
      ? vs
      : "AI_RECOMMENDED_UNVERIFIED";
  const w = o["warnings"];
  const warnings = Array.isArray(w) ? w.filter((x): x is string => typeof x === "string") : [];
  return {
    id: o["id"],
    type,
    title: o["title"],
    citation: typeof o["citation"] === "string" ? o["citation"] : o["title"],
    article: typeof o["article"] === "string" ? o["article"] : undefined,
    paragraph: typeof o["paragraph"] === "string" ? o["paragraph"] : undefined,
    inciso: typeof o["inciso"] === "string" ? o["inciso"] : undefined,
    excerpt: o["excerpt"],
    legalIssue: typeof o["legalIssue"] === "string" ? o["legalIssue"] : "",
    whyRelevant: typeof o["whyRelevant"] === "string" ? o["whyRelevant"] : "",
    suggestedUse: typeof o["suggestedUse"] === "string" ? o["suggestedUse"] : "",
    confidence:
      typeof o["confidence"] === "number" && !Number.isNaN(o["confidence"]) ? o["confidence"] : 0.5,
    verificationStatus,
    sourceUrl: typeof o["sourceUrl"] === "string" ? o["sourceUrl"] : undefined,
    warnings,
  };
}

function coerceJurisprudence(raw: unknown): JurisprudenceCandidate | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o["id"] !== "string" || typeof o["court"] !== "string" || typeof o["title"] !== "string") return null;
  const classOrType = typeof o["classOrType"] === "string" ? o["classOrType"] : "Acórdão";
  const vs = o["verificationStatus"];
  const verificationStatus =
    vs === "AI_RECOMMENDED_UNVERIFIED" ||
    vs === "USER_PINNED" ||
    vs === "USER_VERIFIED" ||
    vs === "VERIFIED_BY_OFFICIAL_SOURCE"
      ? vs
      : "AI_RECOMMENDED_UNVERIFIED";
  const w = o["warnings"];
  const warnings = Array.isArray(w) ? w.filter((x): x is string => typeof x === "string") : [];
  const conf = o["confidence"];
  return {
    id: o["id"],
    court: o["court"],
    classOrType,
    processNumber: typeof o["processNumber"] === "string" ? o["processNumber"] : undefined,
    rapporteur: typeof o["rapporteur"] === "string" ? o["rapporteur"] : undefined,
    judgmentDate: typeof o["judgmentDate"] === "string" ? o["judgmentDate"] : undefined,
    publicationDate: typeof o["publicationDate"] === "string" ? o["publicationDate"] : undefined,
    title: o["title"],
    summary: typeof o["summary"] === "string" ? o["summary"] : "",
    holding: typeof o["holding"] === "string" ? o["holding"] : "",
    excerpt:
      typeof o["excerpt"] === "string"
        ? o["excerpt"]
        : typeof o["summary"] === "string"
          ? o["summary"]
          : "",
    legalIssue: typeof o["legalIssue"] === "string" ? o["legalIssue"] : "",
    whyRelevant: typeof o["whyRelevant"] === "string" ? o["whyRelevant"] : "",
    suggestedUse: typeof o["suggestedUse"] === "string" ? o["suggestedUse"] : "",
    confidence: typeof conf === "number" && !Number.isNaN(conf) ? conf : 0.5,
    verificationStatus,
    sourceUrl: typeof o["sourceUrl"] === "string" ? o["sourceUrl"] : undefined,
    warnings,
  };
}

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

  const parsed = legalResearchPinBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload inválido", details: parsed.error.flatten() },
      { status: 400, headers: rl.headers },
    );
  }

  const row = await findCaseInWorkspace(workspaceId, parsed.data.caseId);
  if (!row) {
    return NextResponse.json({ error: "Não encontrado." }, { status: 404, headers: rl.headers });
  }

  let candidate: LegalFoundationCandidate | JurisprudenceCandidate | null = null;
  if (parsed.data.foundation !== undefined && parsed.data.foundation !== null) {
    candidate = coerceFoundation(parsed.data.foundation);
  } else if (parsed.data.jurisprudence !== undefined && parsed.data.jurisprudence !== null) {
    candidate = coerceJurisprudence(parsed.data.jurisprudence);
  } else if (parsed.data.candidateId && parsed.data.kind) {
    return NextResponse.json(
      {
        error:
          "Para fixar no caso, envie o objeto completo em foundation ou jurisprudence (retorno da pesquisa assistida).",
      },
      { status: 400, headers: rl.headers },
    );
  }

  if (!candidate) {
    return NextResponse.json(
      { error: "Não foi possível interpretar o candidato. Verifique os campos obrigatórios." },
      { status: 400, headers: rl.headers },
    );
  }

  const t0 = Date.now();
  try {
    const r = await addPinnedFoundationToCase(parsed.data.caseId, workspaceId, candidate, userId);
    logLegalResearchJsonLine({
      event: "legal_research.pin",
      workspaceId,
      caseId: parsed.data.caseId,
      queryLen: 0,
      durationMs: Date.now() - t0,
      promptVersion: "",
      ok: true,
      extra: {
        candidateId: scrubPii(candidate.id),
        pinnedId: r.id,
        status: r.status,
      },
    });
    return NextResponse.json(
      { ok: true, pinnedId: r.id, status: r.status },
      { status: r.status === "already_pinned" ? 200 : 201, headers: rl.headers },
    );
  } catch (e) {
    const status = typeof e === "object" && e !== null && "status" in e ? Number((e as { status: number }).status) : 500;
    logLegalResearchJsonLine({
      event: "legal_research.pin",
      workspaceId,
      caseId: parsed.data.caseId,
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
    return NextResponse.json({ error: "Não foi possível fixar o fundamento neste momento." }, { status: 500, headers: rl.headers });
  }
}
