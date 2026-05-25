import { describe, expect, it } from "vitest";
import { deriveAsaasEventId } from "@/lib/billing/asaas/webhook-idempotency";

describe("Asaas subscription reuse (unit)", () => {
  it("event id estável por payment evita duplicata webhook", () => {
    const a = deriveAsaasEventId({
      event: "PAYMENT_CONFIRMED",
      payment: {
        id: "pay_same",
        customer: "cus",
        status: "CONFIRMED",
        value: 1,
        dueDate: "2026-01-01",
      },
    });
    const b = deriveAsaasEventId({
      event: "PAYMENT_CONFIRMED",
      payment: {
        id: "pay_same",
        customer: "cus",
        status: "CONFIRMED",
        value: 1,
        dueDate: "2026-01-01",
      },
    });
    expect(a).toBe(b);
  });
});
