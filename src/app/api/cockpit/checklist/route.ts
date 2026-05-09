/**
 * Checklist real do cockpit operacional do escritório.
 *
 * Cada item retorna:
 *  - name      humano
 *  - ok        bool (atendeu o critério mínimo do MVP)
 *  - detail    contagem/diagnóstico curto
 *  - hint?     próxima ação concreta quando NÃO ok
 *
 * O endpoint nunca lança — devolve sempre um JSON estável.
 */

import { NextResponse } from "next/server";
import { CorpusProvider } from "@prisma/client";
import "@/lib/env-normalize";
import { prisma } from "@/lib/prisma";
import {
  describeRedisUrl,
  pingRedis,
} from "@/lib/redis";
import { getWorkspaceContext, requirePermission } from "@/lib/auth/session";
import { CORPUS_COLLECTIONS } from "@/lib/corpus/qdrant-collections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CheckItem = {
  id: string;
  name: string;
  ok: boolean;
  detail: string;
  hint?: string;
};

async function checkSupabase(): Promise<CheckItem> {
  const url = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  const anon = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
  if (!url || !anon) {
    return {
      id: "supabase",
      name: "Supabase",
      ok: false,
      detail: "URL/ANON_KEY ausentes",
      hint: "Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY na Vercel.",
    };
  }
  try {
    const res = await fetch(`${url}/auth/v1/health`, {
      cache: "no-store",
      headers: { apikey: anon },
    });
    if (!res.ok) {
      return {
        id: "supabase",
        name: "Supabase",
        ok: false,
        detail: `auth /health ${res.status}`,
        hint: "Cheque https://status.supabase.com.",
      };
    }
    return { id: "supabase", name: "Supabase", ok: true, detail: "auth respondeu" };
  } catch (e) {
    return {
      id: "supabase",
      name: "Supabase",
      ok: false,
      detail: (e as Error).message,
    };
  }
}

async function checkRedis(): Promise<CheckItem> {
  const info = describeRedisUrl();
  if (!info.envPresent) {
    return {
      id: "redis",
      name: "Redis",
      ok: false,
      detail: "REDIS_URL ausente",
      hint: "Configure rediss:// na Vercel (Upstash → Connect → aba TLS).",
    };
  }
  if (info.protocol !== "rediss" && info.protocol !== "redis") {
    return {
      id: "redis",
      name: "Redis",
      ok: false,
      detail: `protocol=${info.protocol}`,
      hint: "Esperado rediss:// (TLS).",
    };
  }
  const ping = await pingRedis(3_500);
  if (ping.ok) {
    return {
      id: "redis",
      name: "Redis",
      ok: true,
      detail: `PONG em ${ping.latencyMs}ms`,
    };
  }
  return {
    id: "redis",
    name: "Redis",
    ok: false,
    detail: ping.errorCode ?? ping.errorMessage ?? "ping falhou",
  };
}

async function checkQdrant(): Promise<CheckItem> {
  const url = process.env["QDRANT_URL"];
  if (!url) {
    return {
      id: "qdrant",
      name: "Qdrant",
      ok: false,
      detail: "QDRANT_URL ausente",
      hint: "Configure Qdrant Cloud e adicione QDRANT_URL/QDRANT_API_KEY.",
    };
  }
  try {
    const headers: Record<string, string> = {};
    const apiKey = process.env["QDRANT_API_KEY"];
    if (apiKey) headers["api-key"] = apiKey;
    const res = await fetch(`${url}/readyz`, { headers, cache: "no-store" });
    if (!res.ok) {
      return {
        id: "qdrant",
        name: "Qdrant",
        ok: false,
        detail: `/readyz ${res.status}`,
      };
    }
    return { id: "qdrant", name: "Qdrant", ok: true, detail: "ready" };
  } catch (e) {
    return {
      id: "qdrant",
      name: "Qdrant",
      ok: false,
      detail: (e as Error).message,
    };
  }
}

async function checkInngest(): Promise<CheckItem> {
  const eventKey = process.env["INNGEST_EVENT_KEY"];
  const signingKey = process.env["INNGEST_SIGNING_KEY"];
  if (!eventKey || !signingKey) {
    return {
      id: "inngest",
      name: "Inngest",
      ok: false,
      detail: "INNGEST_EVENT_KEY ou INNGEST_SIGNING_KEY ausente",
      hint: "Configure as duas chaves no Vercel.",
    };
  }
  return {
    id: "inngest",
    name: "Inngest",
    ok: true,
    detail: "credenciais presentes",
  };
}

async function checkUpload(workspaceId: string): Promise<CheckItem> {
  const total = await prisma.document.count({ where: { workspaceId } });
  const failed = await prisma.document.count({
    where: { workspaceId, status: "FAILED" },
  });
  if (total === 0) {
    return {
      id: "upload",
      name: "Upload",
      ok: true,
      detail: "0 documentos enviados ainda",
    };
  }
  return {
    id: "upload",
    name: "Upload",
    ok: failed < total,
    detail: `${total} documentos · ${failed} FAILED`,
    ...(failed >= total
      ? { hint: "Todos os documentos falharam. Veja Inngest run logs e rode `npm run documents:audit`." }
      : {}),
  };
}

async function checkDocumentChunks(workspaceId: string): Promise<CheckItem> {
  const docs = await prisma.document.count({ where: { workspaceId } });
  if (docs === 0) {
    return {
      id: "documentChunks",
      name: "DocumentChunk",
      ok: true,
      detail: "sem documentos para chunkar ainda",
    };
  }
  const chunks = await prisma.documentChunk.count({
    where: { document: { workspaceId } },
  });
  return {
    id: "documentChunks",
    name: "DocumentChunk",
    ok: chunks > 0,
    detail: `${chunks} chunks de ${docs} documento(s)`,
    ...(chunks === 0
      ? { hint: "Pipeline Inngest não está gerando chunks. Rode `npm run documents:audit`." }
      : {}),
  };
}

async function checkOfficialCorpus(): Promise<CheckItem> {
  const norms = await prisma.legalNorm.count({
    where: { sourceProvider: CorpusProvider.MANUAL },
  });
  const chunks = await prisma.legalChunk.count({
    where: { norm: { sourceProvider: CorpusProvider.MANUAL } },
  });
  const okMin = norms >= 6 && chunks >= 20;
  return {
    id: "officialCorpus",
    name: "Corpus oficial",
    ok: okMin,
    detail: `${norms} normas · ${chunks} chunks (MANUAL)`,
    ...(okMin
      ? {}
      : {
          hint: "Rode `npm run corpus:seed:minimal-legal` para popular CF/CPC/CC/CDC/MP/EAOAB.",
        }),
  };
}

async function checkQdrantCorpus(): Promise<CheckItem> {
  const url = process.env["QDRANT_URL"];
  if (!url) {
    return {
      id: "qdrantCorpus",
      name: "Qdrant corpus",
      ok: false,
      detail: "QDRANT_URL ausente",
    };
  }
  try {
    const headers: Record<string, string> = { "content-type": "application/json" };
    const apiKey = process.env["QDRANT_API_KEY"];
    if (apiKey) headers["api-key"] = apiKey;
    const res = await fetch(
      `${url}/collections/${CORPUS_COLLECTIONS.norms}`,
      { headers, cache: "no-store" },
    );
    if (!res.ok) {
      return {
        id: "qdrantCorpus",
        name: "Qdrant corpus",
        ok: false,
        detail: `${CORPUS_COLLECTIONS.norms}: HTTP ${res.status}`,
        hint: "Rode `npm run qdrant:init` para criar collections.",
      };
    }
    const json = (await res.json()) as { result?: { points_count?: number } };
    const points = json.result?.points_count ?? 0;
    return {
      id: "qdrantCorpus",
      name: "Qdrant corpus",
      ok: points > 0,
      detail: `${CORPUS_COLLECTIONS.norms}: ${points} points`,
      ...(points === 0
        ? { hint: "Rode `npm run corpus:reindex:minimal` após popular o corpus." }
        : {}),
    };
  } catch (e) {
    return {
      id: "qdrantCorpus",
      name: "Qdrant corpus",
      ok: false,
      detail: (e as Error).message,
    };
  }
}

async function checkIntegrations(workspaceId: string): Promise<CheckItem> {
  const total = await prisma.integration.count({ where: { workspaceId } });
  return {
    id: "integrations",
    name: "Integrações externas",
    ok: total > 0,
    detail:
      total > 0
        ? `${total} configurada(s)`
        : "nenhuma configurada — sem PJe/e-SAJ/Projudi/EPROC/etc.",
  };
}

export async function GET() {
  try {
    await requirePermission("observabilityView");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Permissão insuficiente")) {
      return NextResponse.json({ items: [], error: "forbidden" }, { status: 403 });
    }
    return NextResponse.json({ items: [], error: "no-workspace" }, { status: 401 });
  }

  let workspaceId: string;
  try {
    const ctx = await getWorkspaceContext();
    workspaceId = ctx.workspaceId;
  } catch {
    return NextResponse.json({ items: [], error: "no-workspace" }, { status: 401 });
  }

  const items = await Promise.all([
    checkSupabase(),
    checkRedis(),
    checkQdrant(),
    checkInngest(),
    checkUpload(workspaceId),
    checkDocumentChunks(workspaceId),
    checkOfficialCorpus(),
    checkQdrantCorpus(),
    checkIntegrations(workspaceId),
  ]);

  return NextResponse.json({ items });
}
