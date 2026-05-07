/**
 * Suite separada do `rate-limit.test.ts` para isolar mocks de `@/lib/redis`.
 * Aqui NÃO há import top-level de `./rate-limit` — cada test importa após o
 * `vi.doMock`, garantindo que o redis mockado seja resolvido.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.doUnmock("@/lib/redis");
});

describe("rate-limit/rateLimit fail-open quando Redis indisponível", () => {
  it("libera com source='fail-open' quando isRedisAvailable=false", async () => {
    vi.doMock("@/lib/redis", () => ({
      getRedis: () => null,
      isRedisAvailable: async () => false,
      isRedisRequired: () => false,
      tryRedisCall: async <T,>(_fn: unknown, fallback: T) => fallback,
    }));
    const { rateLimit } = await import("./rate-limit");
    const result = await rateLimit({ key: "fail-open", limit: 5, windowSeconds: 60 });
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(5);
    expect(result.remaining).toBe(5);
    expect(result.source).toBe("fail-open");
  });
});

describe("rate-limit/rateLimit bloqueia após exceder o limite", () => {
  it("primeiros N pedidos passam, próximos são bloqueados", async () => {
    let count = 0;
    vi.doMock("@/lib/redis", () => ({
      getRedis: () => ({
        multi: () => ({
          incr: () => {},
          expire: () => {},
          exec: async () => [[null, ++count]],
        }),
      }),
      isRedisAvailable: async () => true,
      isRedisRequired: () => true,
      tryRedisCall: async <T,>(fn: (r: unknown) => Promise<T>) => {
        return fn({
          multi: () => ({
            incr: () => {},
            expire: () => {},
            exec: async () => [[null, ++count]],
          }),
        });
      },
    }));
    const { rateLimit } = await import("./rate-limit");
    const limit = 3;
    const calls: boolean[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await rateLimit({ key: "burst", limit, windowSeconds: 60 });
      calls.push(r.allowed);
    }
    expect(calls).toEqual([true, true, true, false, false]);
    // Cada chamada que vai pro Redis deve incrementar o contador externo.
    expect(count).toBeGreaterThanOrEqual(3);
  });
});
