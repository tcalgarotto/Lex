import type { AsaasErrorResponse } from "./types";

export class AsaasApiError extends Error {
  readonly status: number;
  readonly body: AsaasErrorResponse;

  constructor(message: string, status: number, body: AsaasErrorResponse) {
    super(message);
    this.name = "AsaasApiError";
    this.status = status;
    this.body = body;
  }
}

export function readAsaasApiKey(): string | undefined {
  return process.env["ASAAS_API_KEY"]?.trim() || undefined;
}

export function readAsaasApiBaseUrl(): string {
  const custom = process.env["ASAAS_API_BASE_URL"]?.trim();
  if (custom) return custom.replace(/\/$/, "");
  return "https://api-sandbox.asaas.com";
}

export function isAsaasBillingConfigured(): boolean {
  return Boolean(readAsaasApiKey());
}

/** `immediate` = ativa Pro sem Asaas (homologação local). */
export function isAsaasBillingImmediateMode(): boolean {
  return process.env["ASAAS_BILLING_MODE"] === "immediate";
}

export function readAsaasWebhookToken(): string | undefined {
  return process.env["ASAAS_WEBHOOK_TOKEN"]?.trim() || undefined;
}

function readUserAgent(): string {
  const v = process.env["JUSTOS_APP_VERSION"]?.trim();
  return v ? `JustOS/${v}` : "JustOS/1.0";
}

const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);

export async function asaasRequest<T>(args: {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  body?: unknown;
  retries?: number;
}): Promise<T> {
  const apiKey = readAsaasApiKey();
  if (!apiKey) {
    throw new Error("ASAAS_API_KEY não configurada.");
  }

  const url = `${readAsaasApiBaseUrl()}${args.path.startsWith("/") ? args.path : `/${args.path}`}`;
  const maxAttempts = Math.min(4, Math.max(1, (args.retries ?? 2) + 1));
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        method: args.method,
        headers: {
          "Content-Type": "application/json",
          access_token: apiKey,
          "User-Agent": readUserAgent(),
        },
        body: args.body !== undefined ? JSON.stringify(args.body) : undefined,
        signal: AbortSignal.timeout(30_000),
      });

      const text = await res.text();
      let parsed: AsaasErrorResponse & T = {} as T & AsaasErrorResponse;
      if (text) {
        try {
          parsed = JSON.parse(text) as T & AsaasErrorResponse;
        } catch {
          throw new AsaasApiError(`Resposta inválida Asaas (${res.status})`, res.status, {});
        }
      }

      if (!res.ok) {
        const msg =
          parsed.errors?.[0]?.description ??
          parsed.errors?.[0]?.code ??
          `Erro Asaas HTTP ${res.status}`;
        const err = new AsaasApiError(msg, res.status, parsed);
        if (RETRYABLE.has(res.status) && attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 300 * attempt));
          continue;
        }
        throw err;
      }

      return parsed as T;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (attempt < maxAttempts && !(e instanceof AsaasApiError)) {
        await new Promise((r) => setTimeout(r, 300 * attempt));
        continue;
      }
      throw lastError;
    }
  }

  throw lastError ?? new Error("Asaas request failed");
}
