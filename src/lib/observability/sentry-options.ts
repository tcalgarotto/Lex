import type { ErrorEvent, EventHint } from "@sentry/nextjs";

/** DSN público (browser) ou server-only. */
export function getSentryDsn(): string | undefined {
  return (
    process.env["NEXT_PUBLIC_SENTRY_DSN"]?.trim() ||
    process.env["SENTRY_DSN"]?.trim() ||
    undefined
  );
}

const SENSITIVE_KEY_RE =
  /authorization|cookie|set-cookie|password|token|secret|api[_-]?key|jwt|bearer|deepseek|service[_-]?role/i;

function scrubValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEY_RE.test(key)) return "[Redacted]";
  if (typeof value === "string") {
    if (/^eyJ[A-Za-z0-9_-]+\./.test(value)) return "[Redacted JWT]";
    if (/sk-[a-z0-9]{12,}/i.test(value)) return "[Redacted API key]";
    if (value.length > 2_000) return `[Truncated; len=${value.length}]`;
  }
  return value;
}

function scrubObject(obj: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!obj) return obj;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = scrubObject(v as Record<string, unknown>);
    } else {
      out[k] = scrubValue(k, v);
    }
  }
  return out;
}

/** Remove PII/secrets antes de enviar ao Sentry (LGPD + gate de segurança). */
export function scrubSentryEvent(event: ErrorEvent, _hint: EventHint): ErrorEvent | null {
  if (event.request) {
    event.request.headers = scrubObject(
      event.request.headers as Record<string, unknown> | undefined,
    ) as ErrorEvent["request"] extends { headers?: infer H } ? H : never;
    if (event.request.cookies) {
      event.request.cookies = scrubObject(
        event.request.cookies as Record<string, unknown>,
      ) as typeof event.request.cookies;
    }
  }
  if (event.extra) {
    event.extra = scrubObject(event.extra as Record<string, unknown>) as typeof event.extra;
  }
  if (event.contexts) {
    event.contexts = scrubObject(event.contexts as Record<string, unknown>) as typeof event.contexts;
  }
  return event;
}

export function baseSentryInitOptions() {
  const dsn = getSentryDsn();
  return {
    dsn,
    enabled: Boolean(dsn),
    environment:
      process.env["VERCEL_ENV"] ?? process.env["NODE_ENV"] ?? "development",
    tracesSampleRate: process.env["NODE_ENV"] === "production" ? 0.05 : 0.2,
    sendDefaultPii: false,
    beforeSend: scrubSentryEvent,
  } as const;
}
