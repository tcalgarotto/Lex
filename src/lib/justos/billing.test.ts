import { describe, expect, it } from "vitest";
import {
  formatJustosPriceBrl,
  justosProYearlySavingsPercent,
  estimateJustosProRenewal,
} from "./billing";
import { buildJustosProSubscriptionPatch } from "./subscription-store";

describe("justos billing", () => {
  it("formata preço BRL", () => {
    expect(formatJustosPriceBrl(129.9)).toContain("129");
  });

  it("calcula economia anual", () => {
    expect(justosProYearlySavingsPercent()).toBeGreaterThan(0);
  });

  it("patch de assinatura mensal", () => {
    const patch = buildJustosProSubscriptionPatch("monthly");
    expect(patch.proEnabled).toBe(true);
    expect(patch.proBillingCycle).toBe("monthly");
    expect(patch.proSubscriptionStatus).toBe("active");
    expect(patch.proSubscribedAt).toBeTruthy();
    const renew = estimateJustosProRenewal(patch.proSubscribedAt!, "monthly");
    expect(renew.getTime()).toBeGreaterThan(Date.now());
  });
});
