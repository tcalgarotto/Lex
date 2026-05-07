import { describe, expect, it, beforeEach, afterEach } from "vitest";

const ORIGINAL_ENV = { ...process.env };

describe("retrieval cache LRU fallback (Redis offline)", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env["REDIS_URL"]; // força modo no-cache em Redis
  });
  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("write+read usa LRU quando Redis está offline (sem throw)", async () => {
    const { buildCacheKey, writeCachedResult, readCachedResult, _testHooks } =
      await import("./cache");
    _testHooks.memoryLRU.clear();
    const key = buildCacheKey({ query: "boa-fé", options: { topK: 8 } });
    const fakeResult = {
      query: "boa-fé",
      rewrittenQueries: ["boa-fé"],
      filters: {},
      intent: { classification: "norm_lookup" },
      chunks: [],
      groundingScore: 0.42,
      confidence: { label: "Média", score: 0.42, reason: "" },
      trace: { traceId: "t1", totalLatencyMs: 1, stages: [], candidates: { dense: 0, bm25: 0, afterFusion: 0, afterGraph: 0, afterRerank: 0, final: 0 } },
      cached: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    await writeCachedResult(key, fakeResult, 60);
    const got = await readCachedResult(key);
    expect(got).not.toBeNull();
    expect(got?.query).toBe("boa-fé");
  });

  it("read sem entrada devolve null, sem erro", async () => {
    const { buildCacheKey, readCachedResult, _testHooks } = await import("./cache");
    _testHooks.memoryLRU.clear();
    const key = buildCacheKey({ query: "nada armazenado" });
    const got = await readCachedResult(key);
    expect(got).toBeNull();
  });
});
