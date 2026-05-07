import { describe, expect, it, beforeEach, afterEach } from "vitest";

const ORIGINAL_ENV = { ...process.env };

describe("rate-limit fail-open", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });
  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("libera com source='fail-open' quando Redis ausente", async () => {
    delete process.env["REDIS_URL"];
    const { rateLimit } = await import("./rate-limit");
    const r = await rateLimit({ key: "test:ip:1.2.3.4", limit: 5, windowSeconds: 60 });
    expect(r.allowed).toBe(true);
    expect(r.source).toBe("fail-open");
    expect(r.remaining).toBe(5);
  });

  it("nunca propaga erro mesmo em chamada inicial", async () => {
    delete process.env["REDIS_URL"];
    const { rateLimit } = await import("./rate-limit");
    await expect(
      rateLimit({ key: "x", limit: 10, windowSeconds: 1 }),
    ).resolves.toMatchObject({ allowed: true });
  });
});
