import { describe, expect, it } from "vitest";
import { isAsaasPaymentPaid } from "@/lib/justos/asaas-payment-sync";

describe("isAsaasPaymentPaid", () => {
  it("reconhece status pagos", () => {
    expect(isAsaasPaymentPaid("RECEIVED")).toBe(true);
    expect(isAsaasPaymentPaid("CONFIRMED")).toBe(true);
    expect(isAsaasPaymentPaid("PENDING")).toBe(false);
  });
});
