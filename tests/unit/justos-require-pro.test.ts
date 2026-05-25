import { describe, expect, it } from "vitest";
import { getJustosProEntitlement } from "@/lib/justos/billing-entitlement";
import { JustosProRequiredError } from "@/lib/justos/require-pro";

describe("getJustosProEntitlement", () => {
  it("nega sem JustOS ativado", () => {
    const r = getJustosProEntitlement({ enabled: false, proEnabled: false });
    expect(r.active).toBe(false);
  });

  it("nega sem proEnabled", () => {
    const r = getJustosProEntitlement({ enabled: true, proEnabled: false });
    expect(r.active).toBe(false);
  });

  it("permite Pro ativo com assinatura active", () => {
    const r = getJustosProEntitlement({
      enabled: true,
      proEnabled: true,
      proSubscriptionStatus: "active",
    });
    expect(r.active).toBe(true);
  });

  it("nega cancelado", () => {
    const r = getJustosProEntitlement({
      enabled: true,
      proEnabled: true,
      proSubscriptionStatus: "cancelled",
    });
    expect(r.active).toBe(false);
  });
});

describe("JustosProRequiredError", () => {
  it("status 403", () => {
    expect(new JustosProRequiredError().status).toBe(403);
  });
});
