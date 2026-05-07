/**
 * Cache do retrieval jurídico — Redis (preferido) + LRU in-memory fallback.
 *
 * Chave determinística: sha256(query + filters + topK + flags).
 * TTL curto (default 5min) — suficiente pra dedup de janelas de retry/UI,
 * sem mascarar updates do corpus.
 *
 * Política:
 * - Tenta Redis primeiro com `tryRedisCall` (timeout 1500ms herdado do client).
 * - Quando Redis está offline, cai para `MemoryLRU` (fallback silencioso).
 *   Isso evita o `max retries per request` que aparecia em dev sem Redis.
 * - Falhas de parsing/serialização nunca explodem o request — sempre
 *   tratamos como cache miss.
 */

import { createHash } from "node:crypto";
import { cacheGet, cacheSet, isRedisAvailable } from "@/lib/redis";
import { MemoryLRU } from "@/lib/cache/memory-lru";
import { getLogger } from "@/lib/logger";
import type {
  LegalRetrievalFilters,
  LegalRetrievalOptions,
  LegalRetrievalResult,
} from "./types";

const PREFIX = "lex:retrieval:legal:v2:";
const DEFAULT_TTL_SEC = 300;
const log = getLogger("lex.retrieval.cache");

const memoryLRU = new MemoryLRU<string>(256);

/** Constrói chave estável a partir dos inputs do retrieval. */
export function buildCacheKey(args: {
  query: string;
  filters?: LegalRetrievalFilters;
  options?: LegalRetrievalOptions;
}): string {
  const payload = {
    q: args.query.trim().toLowerCase(),
    f: stableFilters(args.filters),
    o: stableOptions(args.options),
  };
  const hash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  return `${PREFIX}${hash}`;
}

function stableFilters(f?: LegalRetrievalFilters): LegalRetrievalFilters | null {
  if (!f) return null;
  return {
    ...(f.kinds ? { kinds: [...f.kinds].sort() } : {}),
    ...(f.jurisdictions ? { jurisdictions: [...f.jurisdictions].sort() } : {}),
    ...(f.tribunals ? { tribunals: [...f.tribunals].sort() } : {}),
    ...(f.normUrns ? { normUrns: [...f.normUrns].sort() } : {}),
    ...(f.articleRefs ? { articleRefs: [...f.articleRefs].sort() } : {}),
    ...(f.asOf ? { asOf: f.asOf.toISOString().slice(0, 10) as unknown as Date } : {}),
    ...(f.publishedAfter
      ? { publishedAfter: f.publishedAfter.toISOString().slice(0, 10) as unknown as Date }
      : {}),
  };
}

function stableOptions(o?: LegalRetrievalOptions): Record<string, unknown> | null {
  if (!o) return null;
  return {
    topK: o.topK ?? null,
    rerankPool: o.rerankPool ?? null,
    useGraphExpansion: o.useGraphExpansion ?? null,
    useRerank: o.useRerank ?? null,
    useQueryRewrite: o.useQueryRewrite ?? null,
    includeGeneric: o.includeGeneric ?? null,
  };
}

/**
 * Lê do cache. Tenta Redis (se disponível) e cai para LRU.
 * Nunca propaga erro — sempre retorna `null` em qualquer falha.
 */
export async function readCachedResult(
  key: string,
): Promise<LegalRetrievalResult | null> {
  let raw: string | null = null;
  if (await isRedisAvailable()) {
    raw = await cacheGet(key);
  }
  if (!raw) {
    raw = memoryLRU.get(key);
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as LegalRetrievalResult;
    return reviveDates(parsed);
  } catch (err) {
    log.warnOnce("read-parse", `cache parse miss: ${(err as Error).message}`);
    return null;
  }
}

/**
 * Grava no cache. Best-effort: erros nunca quebram o pipeline.
 * Sempre escreve em LRU (tem custo zero); Redis só se disponível.
 */
export async function writeCachedResult(
  key: string,
  result: LegalRetrievalResult,
  ttlSec = DEFAULT_TTL_SEC,
): Promise<void> {
  let serialized: string;
  try {
    serialized = JSON.stringify(result);
  } catch (err) {
    log.warnOnce("write-stringify", `cache stringify falhou: ${(err as Error).message}`);
    return;
  }
  memoryLRU.set(key, serialized, ttlSec);
  if (await isRedisAvailable()) {
    await cacheSet(key, serialized, ttlSec);
  }
}

function reviveDates(r: LegalRetrievalResult): LegalRetrievalResult {
  return {
    ...r,
    chunks: r.chunks.map((c) => ({
      ...c,
      validFrom: new Date(c.validFrom as unknown as string),
      validTo: c.validTo ? new Date(c.validTo as unknown as string) : null,
      norm: {
        ...c.norm,
        publishedAt: c.norm.publishedAt
          ? new Date(c.norm.publishedAt as unknown as string)
          : null,
      },
    })),
    intent: {
      ...r.intent,
      ...(r.intent.asOf ? { asOf: new Date(r.intent.asOf as unknown as string) } : {}),
      ...(r.intent.publishedAfter
        ? { publishedAfter: new Date(r.intent.publishedAfter as unknown as string) }
        : {}),
    },
  };
}

export const _testHooks = { memoryLRU };
