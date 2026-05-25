import type { LexJustosEventName, LexJustosEventPayload } from "./types";
import type { N8nSecretaryPayload } from "./secretary-from-case";
import { readJustosN8nWebhookSecret, readJustosN8nWebhookUrl } from "./env";
import { isJustosProActive, readJustosWorkspaceConfig } from "./workspace-config";

const PRO_ONLY_EVENTS = new Set<LexJustosEventName>([
  "lex.deadline.approaching",
  "lex.message.inbound",
]);

/** Workflow n8n `lex-case-secretary` usa `draft.generated`, não `lex.draft.generated`. */
function toN8nEventName(event: LexJustosEventName): string {
  return event.startsWith("lex.") ? event.slice(4) : event;
}

/**
 * Dispara evento para n8n / JustOS Command.
 * No-op se `LEX_N8N_WEBHOOK_URL` ausente ou JustOS desligado no workspace.
 */
export async function emitLexJustosEvent(args: {
  event: LexJustosEventName;
  workspaceId: string;
  caseId?: string;
  workspaceOnboardingJson?: unknown;
  title?: string;
  secretary?: N8nSecretaryPayload;
  allowedRecipients?: string[];
  extras?: Record<string, unknown>;
  meta?: Record<string, unknown>;
}): Promise<{ sent: boolean; skipped?: string }> {
  const config = readJustosWorkspaceConfig(args.workspaceOnboardingJson ?? {});
  const devEmit = process.env["JUSTOS_DEV_EMIT"] === "true";
  if (!config.enabled && !devEmit) {
    return { sent: false, skipped: "justos_disabled" };
  }

  const requiresPro = PRO_ONLY_EVENTS.has(args.event);
  if (requiresPro && !isJustosProActive(config)) {
    return { sent: false, skipped: "justos_pro_required" };
  }

  const url = readJustosN8nWebhookUrl();
  if (!url) {
    return { sent: false, skipped: "no_webhook_url" };
  }

  const payload: LexJustosEventPayload = {
    event: args.event,
    workspaceId: args.workspaceId,
    caseId: args.caseId,
    timestamp: new Date().toISOString(),
    requiresPro,
    meta: args.meta,
  };

  const secret = readJustosN8nWebhookSecret();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (secret) headers["x-lex-n8n-secret"] = secret;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        ...payload,
        event: toN8nEventName(args.event),
        title: args.title,
        secretary: args.secretary,
        allowedRecipients: args.allowedRecipients,
        extras: { ...args.extras, ...args.meta },
        trace_id: args.caseId
          ? `lex_${args.caseId}_${Date.now()}`
          : `lex_ws_${args.workspaceId}_${Date.now()}`,
      }),
    });
    if (!res.ok) {
      return { sent: false, skipped: `http_${res.status}` };
    }
    return { sent: true };
  } catch {
    return { sent: false, skipped: "fetch_error" };
  }
}
