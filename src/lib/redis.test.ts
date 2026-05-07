import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

describe("redis lazy + fail-safe", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });
  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("getRedis() retorna null quando REDIS_URL ausente (modo no-cache)", async () => {
    delete process.env["REDIS_URL"];
    const mod = await import("./redis");
    expect(mod.getRedis()).toBeNull();
  });

  it("isRedisAvailable() devolve false sem REDIS_URL — sem throw", async () => {
    delete process.env["REDIS_URL"];
    const mod = await import("./redis");
    const ok = await mod.isRedisAvailable();
    expect(ok).toBe(false);
  });

  it("tryRedisCall(fallback) devolve fallback sem REDIS_URL", async () => {
    delete process.env["REDIS_URL"];
    const mod = await import("./redis");
    const out = await mod.tryRedisCall(async () => "valor", "fallback");
    expect(out).toBe("fallback");
  });

  it("cacheGet/cacheSet são silenciosos sem REDIS_URL", async () => {
    delete process.env["REDIS_URL"];
    const mod = await import("./redis");
    await mod.cacheSet("k", "v", 10);
    const v = await mod.cacheGet("k");
    expect(v).toBeNull();
  });

  it("isRedisRequired() respeita REDIS_REQUIRED=true", async () => {
    process.env["REDIS_REQUIRED"] = "true";
    (process.env as Record<string, string>)["NODE_ENV"] = "development";
    const mod = await import("./redis");
    expect(mod.isRedisRequired()).toBe(true);
  });

  it("isRedisRequired() default true em production", async () => {
    delete process.env["REDIS_REQUIRED"];
    (process.env as Record<string, string>)["NODE_ENV"] = "production";
    const mod = await import("./redis");
    expect(mod.isRedisRequired()).toBe(true);
  });

  it("isRedisRequired() default false em development", async () => {
    delete process.env["REDIS_REQUIRED"];
    (process.env as Record<string, string>)["NODE_ENV"] = "development";
    const mod = await import("./redis");
    expect(mod.isRedisRequired()).toBe(false);
  });
});
