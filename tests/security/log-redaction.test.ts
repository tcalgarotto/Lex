import { describe, it, expect } from "vitest";
import { scrubSecrets } from "@/lib/logger";

describe("Log Redaction (P0 security)", () => {
  it("aplica scrubSecrets a campos de PII típicos em metadados de log", () => {
    const payload: Record<string, string> = {
      email: "user@corp.br",
      cpf: "529.982.247-25",
    };
    const redacted = scrubSecrets(payload) as Record<string, string>;
    expect(redacted["email"]).toBe("***");
    expect(redacted["cpf"]).toBe("***");
  });
});
