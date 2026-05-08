/**
 * Cliente Redis singleton resiliente — com diagnóstico observável.
 *
 * Princípios:
 * - **Lazy connect**: socket só abre na 1ª operação. Importar é grátis.
 * - **Fail fast**: `maxRetriesPerRequest=1` + `enableOfflineQueue=false`
 *   evitam pendurar requests por 10-20s quando Redis está offline.
 * - **TLS explícito para `rediss://`**: ioredis já infere TLS pelo scheme,
 *   mas reforçamos `tls: { servername: host }` para garantir SNI (necessário
 *   em alguns provedores como Upstash quando há proxy intermediário).
 * - **Timeouts realistas**: TLS handshake até Upstash em cold start de Vercel
 *   pode levar 500-1500ms. `connectTimeout=5s`, `commandTimeout=3s`.
 * - **Probe diagnóstico**: `pingRedis()` faz connect+ping com timeout
 *   controlado e devolve estrutura inspecionável (errorCode/errorName) para
 *   `/api/health` e `npm run redis:check` — sem nunca expor segredo.
 *
 * Quem importa este módulo NÃO deve presumir que Redis está disponível.
 * Use sempre `tryRedisCall(fn)` ou cheque `await isRedisAvailable()`.
 */

import Redis, { type RedisOptions } from "ioredis";
import { getLogger } from "@/lib/logger";

const log = getLogger("redis");

let client: Redis | null = null;
let lastFailAt = 0;
let lastAvailableAt = 0;
let cachedAvailable: boolean | null = null;

/** TTL do cache de probe `PING`. */
const AVAILABILITY_TTL_MS = 5_000;

/** Timeout de probe (ms). TLS handshake Upstash custa 200-1200ms em cold-start. */
const PROBE_TIMEOUT_MS = 2_500;

export function isRedisRequired(): boolean {
  const flag = (process.env["REDIS_REQUIRED"] ?? "").trim().toLowerCase();
  if (flag === "true" || flag === "1") return true;
  if (flag === "false" || flag === "0") return false;
  return process.env["NODE_ENV"] === "production";
}

export function getRedisUrl(): string | null {
  const url = (process.env["REDIS_URL"] ?? "").trim();
  return url.length > 0 ? url : null;
}

/**
 * Snapshot inspecionável do REDIS_URL — NUNCA contém senha.
 * Seguro para incluir em `/api/health`, logs e respostas a admins.
 */
export type RedisUrlInfo = {
  envPresent: boolean;
  /** "rediss" | "redis" | "https" (REST) | "unknown" (parse falhou) | "" (ausente) */
  protocol: string;
  /** Host parseado, sem userinfo. Ex.: "fluent-crappie-117882.upstash.io". */
  host: string;
  port: number;
  username: string;
  hasPassword: boolean;
  /** True quando scheme é `rediss://` (TLS implícito). */
  tls: boolean;
  /** Erro estrutural de parse, se houver. */
  parseError?: string;
};

export function describeRedisUrl(): RedisUrlInfo {
  const raw = getRedisUrl();
  if (!raw) {
    return {
      envPresent: false,
      protocol: "",
      host: "",
      port: 0,
      username: "",
      hasPassword: false,
      tls: false,
    };
  }
  try {
    const u = new URL(raw);
    const proto = u.protocol.replace(/:$/, "").toLowerCase();
    const tls = proto === "rediss";
    return {
      envPresent: true,
      protocol: proto,
      host: u.hostname,
      port: u.port ? Number(u.port) : tls ? 6379 : 6379,
      username: u.username || (tls ? "default" : ""),
      hasPassword: u.password.length > 0,
      tls,
    };
  } catch (err) {
    return {
      envPresent: true,
      protocol: "unknown",
      host: "",
      port: 0,
      username: "",
      hasPassword: false,
      tls: false,
      parseError: (err as Error).message,
    };
  }
}

function buildOptions(info: RedisUrlInfo): RedisOptions {
  const opts: RedisOptions = {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    enableReadyCheck: true,
    connectTimeout: 5_000,
    commandTimeout: 3_000,
    reconnectOnError: () => false,
    retryStrategy: (times: number) => {
      if (times > 2) return null; // no infinite reconnect loop
      return Math.min(times * 250, 1_000);
    },
  };
  // Reforça TLS+SNI quando rediss://. Importante para Upstash atrás de proxy.
  if (info.tls && info.host) {
    opts.tls = { servername: info.host };
  }
  return opts;
}

/**
 * Devolve o singleton (ou null se não houver REDIS_URL).
 * NÃO chama `connect()` — quem usar deve estar pronto para falhar.
 */
export function getRedis(): Redis | null {
  if (client) return client;
  const url = getRedisUrl();
  if (!url) {
    log.warnOnce("missing-url", "REDIS_URL ausente — operando em modo no-cache.");
    return null;
  }
  const info = describeRedisUrl();
  client = new Redis(url, buildOptions(info));
  client.on("error", (err: Error) => {
    lastFailAt = Date.now();
    cachedAvailable = false;
    // Mensagem segura: nunca contém senha — ioredis não loga URL completa.
    log.warnOnce("error", `Redis indisponível: ${err.message}`);
  });
  client.on("ready", () => {
    lastAvailableAt = Date.now();
    cachedAvailable = true;
  });
  client.on("end", () => {
    cachedAvailable = false;
  });
  return client;
}

/**
 * Probe leve. Cacheado por `AVAILABILITY_TTL_MS` para evitar `PING` em rajada.
 * Garante NUNCA throw.
 */
export async function isRedisAvailable(): Promise<boolean> {
  const r = getRedis();
  if (!r) return false;
  const now = Date.now();
  if (
    cachedAvailable !== null &&
    now - Math.max(lastAvailableAt, lastFailAt) < AVAILABILITY_TTL_MS
  ) {
    return cachedAvailable;
  }
  try {
    const pong = await Promise.race([
      r.ping(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("ping timeout")), PROBE_TIMEOUT_MS),
      ),
    ]);
    cachedAvailable = pong === "PONG";
    lastAvailableAt = now;
    return cachedAvailable;
  } catch {
    cachedAvailable = false;
    lastFailAt = now;
    return false;
  }
}

/** Resultado de diagnóstico de `pingRedis()` — seguro para /api/health. */
export type RedisPingResult = {
  ok: boolean;
  latencyMs: number;
  pong?: string;
  errorName?: string;
  errorCode?: string;
  errorMessage?: string;
};

/**
 * Probe de diagnóstico — cria um cliente isolado, conecta e dá PING.
 * Diferente de `isRedisAvailable()`: não usa o singleton nem cache, e
 * devolve detalhes do erro (sem segredo) quando falha.
 *
 * Use em scripts e em /api/health quando precisa explicar POR QUE falhou.
 */
export async function pingRedis(timeoutMs = 4_000): Promise<RedisPingResult> {
  const url = getRedisUrl();
  const start = Date.now();
  if (!url) {
    return {
      ok: false,
      latencyMs: 0,
      errorName: "MissingUrl",
      errorMessage: "REDIS_URL ausente",
    };
  }
  const info = describeRedisUrl();
  const probe = new Redis(url, {
    ...buildOptions(info),
    lazyConnect: true,
    maxRetriesPerRequest: 0,
    retryStrategy: () => null,
  });
  try {
    await probe.connect();
    const pong = await Promise.race<string>([
      probe.ping(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`ping timeout ${timeoutMs}ms`)), timeoutMs),
      ),
    ]);
    return {
      ok: pong === "PONG",
      latencyMs: Date.now() - start,
      pong,
    };
  } catch (err) {
    const e = err as NodeJS.ErrnoException & { name?: string; code?: string };
    return {
      ok: false,
      latencyMs: Date.now() - start,
      errorName: e?.name ?? "Error",
      ...(e?.code ? { errorCode: e.code } : {}),
      errorMessage: redactSecrets(e?.message ?? String(err)),
    };
  } finally {
    try {
      probe.disconnect();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Defesa em profundidade: se por acaso uma mensagem de erro contiver a URL
 * inteira (raro, mas existe `MOVED 14534 host:port` etc.), removemos qualquer
 * coisa parecida com `:password@` antes do host.
 */
function redactSecrets(msg: string): string {
  return msg.replace(/(redis(?:s)?:\/\/[^:]+:)[^@]+(@)/gi, "$1***$2");
}

/**
 * Executa `fn` se Redis estiver disponível, senão retorna `fallback`.
 * Errors são engolidos com warnOnce — nunca propagam para o caller.
 */
export async function tryRedisCall<T>(
  fn: (r: Redis) => Promise<T>,
  fallback: T,
  scope = "op",
): Promise<T> {
  const r = getRedis();
  if (!r) return fallback;
  try {
    return await fn(r);
  } catch (err) {
    log.warnOnce(`call:${scope}`, `Redis call falhou (${scope}): ${(err as Error).message}`);
    return fallback;
  }
}

export async function cacheGet(key: string): Promise<string | null> {
  return tryRedisCall(async (r) => (await r.get(key)) ?? null, null, "get");
}

export async function cacheSet(
  key: string,
  value: string,
  ttlSeconds?: number,
): Promise<void> {
  await tryRedisCall(
    async (r) => {
      if (ttlSeconds !== undefined) {
        await r.set(key, value, "EX", ttlSeconds);
      } else {
        await r.set(key, value);
      }
      return null;
    },
    null,
    "set",
  );
}

/**
 * Reseta o singleton (apenas testes/scripts). Em produção isso vaza socket;
 * use com cuidado.
 */
export function _resetRedisForTests(): void {
  if (client) {
    try {
      client.disconnect();
    } catch {
      /* ignore */
    }
  }
  client = null;
  cachedAvailable = null;
  lastFailAt = 0;
  lastAvailableAt = 0;
}
