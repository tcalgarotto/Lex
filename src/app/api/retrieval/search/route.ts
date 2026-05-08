import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/session";
import { retrieveLegalContext } from "@/lib/retrieval/legal";

/**
 * Endpoint "amigável" da Pesquisa jurídica do usuário final.
 *
 * Reaproveita `retrieveLegalContext` mas remove campos técnicos do payload
 * (scores brutos por mecanismo, traces, fallbackFlags). Para o modo
 * auditável/admin, use `/api/retrieval/explain`.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const topK = parseTopK(url.searchParams.get("topK"));
  const scope = url.searchParams.get("scope") ?? "tudo";
  const caseId = url.searchParams.get("caseId");

  if (q.length < 2) {
    return NextResponse.json({
      query: q,
      results: [],
      bases: defaultBases(),
      confidence: null,
      ranBy: "skip",
    });
  }

  let workspaceId: string;
  try {
    ({ workspaceId } = await getWorkspaceContext());
  } catch {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  try {
    const result = await retrieveLegalContext(q, {
      topK,
      useCache: true,
      workspaceId,
    });

    const results = result.chunks.map((c) => ({
      id: c.chunkId,
      text: c.text,
      articleRef: c.articleRef,
      hierarchy: c.fullPath,
      score: roundScore(c.scores.final ?? 0),
      norm: {
        id: c.norm.id,
        urn: c.norm.urn,
        kind: c.norm.kind,
        identifier: c.norm.identifier,
        title: c.norm.title,
        jurisdiction: c.norm.jurisdiction,
        tribunal: c.norm.tribunal,
      },
    }));

    return NextResponse.json({
      query: q,
      scope,
      caseId: caseId ?? null,
      results,
      total: results.length,
      bases: defaultBases(),
      confidence: result.confidence,
      cached: result.cached,
    });
  } catch (err) {
    console.error("[/api/retrieval/search] erro", err);
    return NextResponse.json(
      { error: "Não foi possível buscar agora.", detail: messageOf(err) },
      { status: 500 },
    );
  }
}

function parseTopK(raw: string | null): number {
  const n = raw ? parseInt(raw, 10) : NaN;
  if (!Number.isFinite(n)) return 8;
  return Math.min(20, Math.max(1, n));
}

function roundScore(n: number): number {
  return Math.round(n * 100) / 100;
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

interface Base {
  key: string;
  label: string;
  available: boolean;
  hint?: string;
}

function defaultBases(): Base[] {
  return [
    { key: "cf", label: "Constituição Federal", available: true },
    { key: "adct", label: "ADCT", available: true },
    {
      key: "infra",
      label: "Legislação infraconstitucional",
      available: false,
      hint: "Em breve",
    },
    {
      key: "jurisprudencia",
      label: "Jurisprudência",
      available: false,
      hint: "Em breve",
    },
  ];
}
