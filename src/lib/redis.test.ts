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

  it("describeRedisUrl() devolve envPresent=false sem REDIS_URL", async () => {
    delete process.env["REDIS_URL"];
    const mod = await import("./redis");
    const info = mod.describeRedisUrl();
    expect(info.envPresent).toBe(false);
    expect(info.protocol).toBe("");
    expect(info.host).toBe("");
    expect(info.hasPassword).toBe(false);
    expect(info.tls).toBe(false);
  });

  it("describeRedisUrl() parseia rediss:// com username, host, port, senha mascarada", async () => {
    process.env["REDIS_URL"] =
      "rediss://default:gQAA-very-secret-token@fluent-crappie-117882.upstash.io:6379";
    const mod = await import("./redis");
    const info = mod.describeRedisUrl();
    expect(info.envPresent).toBe(true);
    expect(info.protocol).toBe("rediss");
    expect(info.host).toBe("fluent-crappie-117882.upstash.io");
    expect(info.port).toBe(6379);
    expect(info.username).toBe("default");
    expect(info.hasPassword).toBe(true);
    expect(info.tls).toBe(true);
    // Sanity: NUNCA expor segredo
    expect(JSON.stringify(info)).not.toContain("gQAA-very-secret-token");
  });

  it("describeRedisUrl() identifica https:// como NÃO-TLS (REST API errada)", async () => {
    process.env["REDIS_URL"] = "https://fluent-crappie-117882.upstash.io";
    const mod = await import("./redis");
    const info = mod.describeRedisUrl();
    expect(info.protocol).toBe("https");
    expect(info.tls).toBe(false); // não é o TLS do redis (rediss)
  });

  it("describeRedisUrl() identifica redis:// (sem TLS)", async () => {
    process.env["REDIS_URL"] = "redis://default:pwd@localhost:6379";
    const mod = await import("./redis");
    const info = mod.describeRedisUrl();
    expect(info.protocol).toBe("redis");
    expect(info.tls).toBe(false);
    expect(info.host).toBe("localhost");
    expect(info.port).toBe(6379);
  });

  it("describeRedisUrl() reporta parseError em URL inválida", async () => {
    process.env["REDIS_URL"] = "isso-nao-eh-uma-url";
    const mod = await import("./redis");
    const info = mod.describeRedisUrl();
    expect(info.envPresent).toBe(true);
    expect(info.protocol).toBe("unknown");
    expect(info.parseError).toBeTruthy();
  });

  it("pingRedis() devolve MissingUrl quando REDIS_URL ausente", async () => {
    delete process.env["REDIS_URL"];
    const mod = await import("./redis");
    const result = await mod.pingRedis(500);
    expect(result.ok).toBe(false);
    expect(result.errorName).toBe("MissingUrl");
    expect(result.errorMessage).toContain("REDIS_URL ausente");
  });
});
