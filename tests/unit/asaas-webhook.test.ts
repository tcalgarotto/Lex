import { afterEach, describe, expect, it, vi } from "vitest";
import { validateAsaasWebhookToken } from "@/lib/billing/asaas/webhook-auth";
import { deriveAsaasEventId } from "@/lib/billing/asaas/webhook-idempotency";

const env = process.env;

afterEach(() => {
  process.env = { ...env };
  vi.restoreAllMocks();
});

describe("validateAsaasWebhookToken", () => {
  it("rejeita token igual à API key", () => {
    process.env["ASAAS_API_KEY"] = "key_abc";
    process.env["ASAAS_WEBHOOK_TOKEN"] = "key_abc";
    const r = validateAsaasWebhookToken("key_abc");
    expect(r.ok).toBe(false);
  });

  it("aceita token forte", () => {
    const token = "a".repeat(40);
    process.env["ASAAS_WEBHOOK_TOKEN"] = token;
    delete process.env["ASAAS_API_KEY"];
    const r = validateAsaasWebhookToken(token);
    expect(r.ok).toBe(true);
  });

  it("rejeita header errado", () => {
    process.env["ASAAS_WEBHOOK_TOKEN"] = "b".repeat(40);
    const r = validateAsaasWebhookToken("wrong");
    expect(r.ok).toBe(false);
  });
});

describe("deriveAsaasEventId", () => {
  it("usa payment id", () => {
    const id = deriveAsaasEventId({
      event: "PAYMENT_CONFIRMED",
      payment: {
        id: "pay_1",
        customer: "cus",
        status: "CONFIRMED",
        value: 1,
        dueDate: "2026-01-01",
      },
    });
    expect(id).toBe("PAYMENT_CONFIRMED:pay_1");
  });
});
