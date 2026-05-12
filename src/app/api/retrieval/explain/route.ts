/**
 * Endpoint enterprise de retrieval auditável.
 *
 * `GET /api/retrieval/explain?q=...&topK=8&useGraph=true&useRerank=true`
 *
 * Retorna o `LegalRetrievalResult` completo + reasoning layers
 * (timeline, issues, contradictions, strategy synthesis). Pensado pra ser
 * consumido pela UI premium (Trace, CitationGraph, GroundingPanel etc.).
 *
 * Auth: requer sessão + workspace ativo.
 */

import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/session";
import { retrieveLegalContext } from "@/lib/retrieval/legal";
import { spotLegalIssues } from "@/lib/legal/reasoning/issue-spotting";
import { detectContradictions } from "@/lib/legal/reasoning/contradiction";
import { synthesizeStrategy } from "@/lib/legal/reasoning/strategy";
import { buildTimelines } from "@/lib/legal/reasoning/timeline";


function flag(value: string | null, def: boolean): boolean {
  if (value == null) return def;
  return value === "1" || value.toLowerCase() === "true";
}

export async function GET(req: Request) {
  const { workspaceId } = await requirePermission("observabilityView");
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ error: "query muito curta" }, { status: 400 });
  }
  const topK = Math.min(20, Math.max(1, Number(searchParams.get("topK") ?? "8")));
  const useGraphExpansion = flag(searchParams.get("useGraph"), true);
  const useRerank = flag(searchParams.get("useRerank"), true);
  const useCache = flag(searchParams.get("useCache"), false); // default false na rota explain
  const tribunalsParam = searchParams.get("tribunals");
  const tribunals = tribunalsParam
    ? tribunalsParam
        .split(",")
        .map((t) => t.trim().toUpperCase())
        .filter(Boolean)
    : [];

  const retrievalArgs: Parameters<typeof retrieveLegalContext>[1] = {
    topK,
    useGraphExpansion,
    useRerank,
    useCache,
    workspaceId,
  };
  if (tribunals.length) {
    retrievalArgs.filters = { tribunals };
  }
  const retrieval = await retrieveLegalContext(q, retrievalArgs);

  const issues = spotLegalIssues({
    query: q,
    intent: retrieval.intent,
    chunks: retrieval.chunks,
  });

  const risks = await detectContradictions({
    chunks: retrieval.chunks,
    intent: retrieval.intent,
    ...(retrieval.intent.asOf ? { asOf: retrieval.intent.asOf } : {}),
  });

  const timelines = await buildTimelines({
    normIds: Array.from(new Set(retrieval.chunks.map((c) => c.norm.id))),
    ...(retrieval.intent.asOf ? { asOf: retrieval.intent.asOf } : {}),
  });

  const strategy = synthesizeStrategy({
    query: q,
    intent: retrieval.intent,
    chunks: retrieval.chunks,
    risks,
    issues,
  });

  return NextResponse.json({
    retrieval,
    reasoning: { issues, risks, timelines, strategy },
  });
}
