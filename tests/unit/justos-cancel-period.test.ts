import { describe, expect, it } from "vitest";
import { getJustosProEntitlement } from "@/lib/justos/billing-entitlement";
import {
  isJustosProAccessValid,
  isJustosProActive,
} from "@/lib/justos/workspace-config";

describe("cancel at period end", () => {
  const future = new Date();
  future.setMonth(future.getMonth() + 1);

  const past = new Date();
  past.setMonth(past.getMonth() - 1);

  it("mantém Pro ativo até proAccessUntil", () => {
    const cfg = {
      enabled: true,
      proEnabled: true,
      proSubscriptionStatus: "active" as const,
      proCancelAtPeriodEnd: true,
      proAccessUntil: future.toISOString(),
    };
    expect(isJustosProAccessValid(cfg)).toBe(true);
    expect(isJustosProActive(cfg)).toBe(true);
    expect(getJustosProEntitlement(cfg).active).toBe(true);
  });

  it("revoga após proAccessUntil", () => {
    const cfg = {
      enabled: true,
      proEnabled: true,
      proSubscriptionStatus: "active" as const,
      proCancelAtPeriodEnd: true,
      proAccessUntil: past.toISOString(),
    };
    expect(isJustosProAccessValid(cfg)).toBe(false);
    expect(isJustosProActive(cfg)).toBe(false);
  });
});
