/**
 * Cliente Redis singleton resiliente.
 *
 * Princípios:
 * - **Lazy connect**: o socket só é aberto na primeira operação real, não no
 *   import. Importar este módulo é grátis.
 * - **Fail fast**: `maxRetriesPerRequest=1` e `enableOfflineQueue=false` quando
 *   `REDIS_REQUIRED=false` (default em dev). Operações falham em ms se Redis
 *   está offline, em vez de pendurar a request 18s atrás de retries.
 * - **Sem spam**: o handler `error` loga apenas a 1ª vez via `logger.warnOnce`.
 *   Os erros subsequentes são contados silenciosamente (visível em
 *   `_logCounters()` para introspeção).
 * - **`isRedisAvailable()`**: probe não destrutivo (`PING` com timeout 250 ms).
 *   Cacheado por 5 s para evitar martelar Redis em rajadas.
 * - **Em produção**: `REDIS_REQUIRED=true` mantém retries + offline queue
 *   habilitados, mas o consumidor (rate limit, cache) é quem decide se
 *   deve fail-open ou fail-closed.
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

/** Quanto tempo (ms) reaproveitamos um probe `PING` recente. */
const AVAILABILITY_TTL_MS = 5_000;

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

function buildOptions(): RedisOptions {
  const required = isRedisRequired();
  return {
    lazyConnect: true,
    maxRetriesPerRequest: required ? 3 : 1,
    enableOfflineQueue: required,
    enableReadyCheck: true,
    connectTimeout: 2_000,
    commandTimeout: 1_500,
    reconnectOnError: () => false,
    retryStrategy: (times: number) => {
      if (!required) return null; // dev: não reconecta — fail-fast
      if (times > 5) return null;
      return Math.min(times * 200, 2_000);
    },
  };
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
  client = new Redis(url, buildOptions());
  client.on("error", (err: Error) => {
    lastFailAt = Date.now();
    cachedAvailable = false;
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
  if (cachedAvailable !== null && now - Math.max(lastAvailableAt, lastFailAt) < AVAILABILITY_TTL_MS) {
    return cachedAvailable;
  }
  try {
    const pong = await Promise.race([
      r.ping(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("ping timeout")), 250),
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
