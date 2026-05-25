import { readAsaasApiKey, readAsaasWebhookToken } from "./client";

const WEAK_TOKENS = new Set([
  "",
  "test",
  "sandbox",
  "asaas",
  "webhook",
  "12345678901234567890123456789012",
]);

export function validateAsaasWebhookToken(header: string | null): {
  ok: boolean;
  reason?: string;
} {
  const expected = readAsaasWebhookToken();
  const isProd = process.env.NODE_ENV === "production";

  if (!expected) {
    if (isProd) {
      return { ok: false, reason: "ASAAS_WEBHOOK_TOKEN obrigatório em produção" };
    }
    if (process.env["ASAAS_WEBHOOK_ALLOW_UNAUTH_DEV"] === "true") {
      return { ok: true };
    }
    return { ok: true, reason: "dev_no_token_configured" };
  }

  if (expected.length < 32 || expected.length > 255 || /\s/.test(expected)) {
    return { ok: false, reason: "ASAAS_WEBHOOK_TOKEN inválido (32–255 chars, sem espaços)" };
  }

  if (WEAK_TOKENS.has(expected.toLowerCase())) {
    return { ok: false, reason: "ASAAS_WEBHOOK_TOKEN fraco" };
  }

  const apiKey = readAsaasApiKey();
  if (apiKey && expected === apiKey) {
    return { ok: false, reason: "ASAAS_WEBHOOK_TOKEN não pode ser igual à API key" };
  }

  if (!header || header !== expected) {
    return { ok: false, reason: "asaas-access-token inválido" };
  }

  return { ok: true };
}
