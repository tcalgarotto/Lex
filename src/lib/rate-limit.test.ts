import { describe, expect, it } from "vitest";
import { getRequestIp, rateLimitHeaders, type RateLimitResult } from "./rate-limit";

describe("rate-limit/getRequestIp", () => {
  it("usa x-forwarded-for (primeiro IP)", () => {
    const h = new Headers({ "x-forwarded-for": "203.0.113.5, 70.41.3.18, 150.172.238.178" });
    expect(getRequestIp(h)).toBe("203.0.113.5");
  });

  it("cai para x-real-ip se não há x-forwarded-for", () => {
    const h = new Headers({ "x-real-ip": "198.51.100.7" });
    expect(getRequestIp(h)).toBe("198.51.100.7");
  });

  it("retorna 'unknown' sem nenhum header", () => {
    expect(getRequestIp(new Headers())).toBe("unknown");
  });
});

describe("rate-limit/rateLimitHeaders", () => {
  it("emite os 3 headers padrão", () => {
    const result: RateLimitResult = {
      allowed: true,
      remaining: 12,
      resetAt: 1717_000_000,
      limit: 30,
      source: "redis",
    };
    const headers = rateLimitHeaders(result);
    expect(headers["X-RateLimit-Limit"]).toBe("30");
    expect(headers["X-RateLimit-Remaining"]).toBe("12");
    expect(headers["X-RateLimit-Reset"]).toBe("1717000000");
    expect(headers["X-RateLimit-Source"]).toBe("redis");
  });
});
