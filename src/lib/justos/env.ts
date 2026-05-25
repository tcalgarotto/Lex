/**
 * Variáveis de ambiente JustOS com fallback LEX_* (compat R0/R1).
 */

function read(name: string, fallback?: string): string | undefined {
  const v = process.env[name]?.trim();
  if (v) return v;
  if (fallback) return process.env[fallback]?.trim() || undefined;
  return undefined;
}

export function readJustosN8nWebhookUrl(): string | undefined {
  return read("JUSTOS_N8N_WEBHOOK_URL", "LEX_N8N_WEBHOOK_URL");
}

export function readJustosN8nWebhookSecret(): string | undefined {
  return read("JUSTOS_N8N_WEBHOOK_SECRET", "LEX_N8N_WEBHOOK_SECRET");
}

export function readJustosN8nServiceToken(): string | undefined {
  return read("JUSTOS_N8N_SERVICE_TOKEN", "LEX_N8N_SERVICE_TOKEN");
}

export function readJustosApiBaseUrl(): string {
  return read("JUSTOS_API_BASE_URL", "LEX_API_BASE_URL") ?? "http://127.0.0.1:3000";
}

export function readJustosCommandUrl(): string | undefined {
  return read("JUSTOS_COMMAND_URL");
}

export function readJustosCommandSecret(): string | undefined {
  return read("JUSTOS_COMMAND_SECRET");
}

/** Produção JustOS Pro: não usar bridge SOLD global (:3300). */
export function isJustosLegacyBridgeEnabled(): boolean {
  return process.env["JUSTOS_USE_LEGACY_BRIDGE"] === "true";
}

export function isJustosCrmWaSendEnabled(): boolean {
  return process.env["JUSTOS_CRM_ENABLE_WA_SEND"] === "true";
}

export function readJustosOpenClawMode(): string {
  return process.env["JUSTOS_OPENCLAW_MODE"]?.trim() || "dev-single";
}
