import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/session";
import { retrieveLegalContext } from "@/lib/retrieval/legal";
import { extractRelevantSnippet } from "@/lib/retrieval/legal/snippet";
import { buildCaseContext } from "@/lib/cases/context";
import { getCorpusManifest } from "@/lib/corpus/manifest";

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
      bases: await dynamicBases(),
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
    // F3: usa contexto do caso (se passado) para enriquecer query expansion.
    let caseContext: { area: string[]; problem?: string } | undefined;
    if (caseId) {
      const ctx = await buildCaseContext({ workspaceId, caseId });
      if (ctx?.brain) {
        caseContext = {
          area: ctx.brain.area ?? [],
          ...(ctx.brain.problem ? { problem: ctx.brain.problem } : {}),
        };
      }
    }

    const result = await retrieveLegalContext(q, {
      topK,
      useCache: true,
      workspaceId,
      ...(caseContext ? { caseContext } : {}),
    });

    const results = result.chunks.map((c) => ({
      id: c.chunkId,
      text: c.text,
      snippet: extractRelevantSnippet(c.text, q, { maxChars: 320 }),
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
      bases: await dynamicBases(),
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

/**
 * F4.1: lista de bases vem do `getCorpusManifest()`. Evita "fake" UI
 * dizendo que algo está disponível quando não está, e expõe ao usuário
 * o que ainda está pendente de indexação.
 */
async function dynamicBases(): Promise<Base[]> {
  try {
    const manifest = await getCorpusManifest();
    const out: Base[] = [];
    for (const norm of manifest.availableNorms) {
      out.push({ key: norm.urn, label: norm.label, available: true });
    }
    for (const hint of manifest.unavailableHints) {
      out.push({
        key: hint.urnPattern,
        label: hint.label,
        available: false,
        hint: "Será indexado em ondas futuras",
      });
    }
    if (out.length > 0) return out;
  } catch {
    /* fallback abaixo */
  }
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
