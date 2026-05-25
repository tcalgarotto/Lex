import { afterEach, describe, expect, it } from "vitest";
import {
  isAsaasBillingConfigured,
  isAsaasBillingImmediateMode,
  readAsaasApiBaseUrl,
} from "@/lib/billing/asaas/client";
import {
  paymentMethodToAsaasBillingType,
  readJustosAsaasBillingType,
  resolvePaymentCheckoutUrl,
} from "@/lib/billing/asaas/justos-pro";
import { readClientRemoteIp } from "@/lib/billing/asaas/credit-card-schema";
import type { AsaasPayment } from "@/lib/billing/asaas/types";
import { getJustosProEntitlement } from "@/lib/justos/billing-entitlement";
import { applyAsaasWebhookToWorkspace } from "@/lib/justos/asaas-billing-sync";

const env = process.env;

afterEach(() => {
  process.env = { ...env };
});

describe("Asaas client env", () => {
  it("usa Sandbox por padrão", () => {
    delete process.env["ASAAS_API_BASE_URL"];
    expect(readAsaasApiBaseUrl()).toBe("https://api-sandbox.asaas.com");
  });

  it("detecta configuração e modo imediato", () => {
    delete process.env["ASAAS_API_KEY"];
    delete process.env["ASAAS_BILLING_MODE"];
    expect(isAsaasBillingConfigured()).toBe(false);
    expect(isAsaasBillingImmediateMode()).toBe(false);

    process.env["ASAAS_API_KEY"] = "test_key";
    expect(isAsaasBillingConfigured()).toBe(true);

    process.env["ASAAS_BILLING_MODE"] = "immediate";
    expect(isAsaasBillingImmediateMode()).toBe(true);
  });
});

describe("paymentMethodToAsaasBillingType", () => {
  it("mapeia pix e cartão", () => {
    expect(paymentMethodToAsaasBillingType("pix")).toBe("PIX");
    expect(paymentMethodToAsaasBillingType("credit_card")).toBe("CREDIT_CARD");
  });
});

describe("readClientRemoteIp", () => {
  it("usa x-forwarded-for", () => {
    const req = new Request("http://localhost", {
      headers: { "x-forwarded-for": "203.0.113.1, 10.0.0.1" },
    });
    expect(readClientRemoteIp(req)).toBe("203.0.113.1");
  });
});

describe("readJustosAsaasBillingType", () => {
  it("aceita PIX e mapeia legado para CREDIT_CARD", () => {
    process.env["ASAAS_BILLING_TYPE"] = "PIX";
    expect(readJustosAsaasBillingType()).toBe("PIX");
    process.env["ASAAS_BILLING_TYPE"] = "BOLETO";
    expect(readJustosAsaasBillingType()).toBe("CREDIT_CARD");
    process.env["ASAAS_BILLING_TYPE"] = "UNDEFINED";
    expect(readJustosAsaasBillingType()).toBe("CREDIT_CARD");
    delete process.env["ASAAS_BILLING_TYPE"];
    expect(readJustosAsaasBillingType()).toBe("CREDIT_CARD");
  });
});

describe("resolvePaymentCheckoutUrl", () => {
  it("prefere invoiceUrl sobre bankSlipUrl", () => {
    const p = {
      id: "pay_1",
      customer: "cus_1",
      status: "PENDING",
      value: 99,
      dueDate: "2026-06-01",
      invoiceUrl: "https://sandbox.asaas.com/i/1",
      bankSlipUrl: "https://sandbox.asaas.com/b/1",
    } as AsaasPayment;
    expect(resolvePaymentCheckoutUrl(p)).toBe("https://sandbox.asaas.com/i/1");
  });
});

describe("getJustosProEntitlement (Asaas pending)", () => {
  it("bloqueia Pro até pagamento confirmado", () => {
    const ent = getJustosProEntitlement({
      enabled: true,
      proEnabled: false,
      proSubscriptionStatus: "inactive",
      asaasSubscriptionId: "sub_test",
    });
    expect(ent.active).toBe(false);
    expect(ent.pendingPayment).toBe(true);
  });
});

describe("applyAsaasWebhookToWorkspace", () => {
  it("ignora evento sem workspace", async () => {
    const result = await applyAsaasWebhookToWorkspace({
      event: "PAYMENT_RECEIVED",
      payment: {
        id: "pay_x",
        customer: "cus_x",
        subscription: "sub_unknown",
        status: "RECEIVED",
        value: 99,
        dueDate: "2026-06-01",
      },
    });
    expect(result.ok).toBe(false);
    expect(result.action).toBe("workspace_not_found");
  });
});
