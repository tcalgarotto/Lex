import { describe, it, expect, beforeEach } from "vitest";
import { _resetProviderRateLimitForTests, acquireProviderSlot } from "./rate-limit";

beforeEach(() => _resetProviderRateLimitForTests());

describe("provider rate-limit (token bucket)", () => {
  it("permite até `ratePerMinute` em rajada inicial", async () => {
    const results = [];
    for (let i = 0; i < 5; i++) {
      results.push(await acquireProviderSlot({ scope: "test", ratePerMinute: 5 }));
    }
    expect(results.every((r) => r.allowed)).toBe(true);
  });

  it("retorna allowed=false em noWait quando bucket vazio", async () => {
    for (let i = 0; i < 3; i++) {
      await acquireProviderSlot({ scope: "test", ratePerMinute: 3 });
    }
    const r = await acquireProviderSlot({
      scope: "test",
      ratePerMinute: 3,
      noWait: true,
    });
    expect(r.allowed).toBe(false);
  });

  it("escopo separado tem bucket independente", async () => {
    for (let i = 0; i < 5; i++) {
      await acquireProviderSlot({ scope: "a", ratePerMinute: 5 });
    }
    const r = await acquireProviderSlot({
      scope: "b",
      ratePerMinute: 5,
      noWait: true,
    });
    expect(r.allowed).toBe(true);
  });
});
