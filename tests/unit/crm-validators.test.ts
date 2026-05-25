import { describe, expect, it } from "vitest";
import { CreateCrmContactSchema } from "@/lib/justos/crm/validators";

describe("CreateCrmContactSchema", () => {
  it("aceita contato mínimo", () => {
    const r = CreateCrmContactSchema.safeParse({ displayName: "Maria Silva" });
    expect(r.success).toBe(true);
  });

  it("rejeita nome vazio", () => {
    const r = CreateCrmContactSchema.safeParse({ displayName: "" });
    expect(r.success).toBe(false);
  });
});
