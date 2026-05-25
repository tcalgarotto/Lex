import type { LexJustosEventName, LexJustosEventPayload } from "./types";
import type { N8nSecretaryPayload } from "./secretary-from-case";
import { readJustosN8nWebhookSecret, readJustosN8nWebhookUrl } from "./env";
import { isJustosProActive, readJustosWorkspaceConfig } from "./workspace-config";

const PRO_ONLY = new Set<string>([
  "lex.deadline.approaching",
  "lex.message.inbound",
  "justos.deadline.approaching",
  "justos.crm.message.inbound",
]);

const LEX_TO_N8N: Record<string, string> = {
  "lex.case.created": "case.created",
  "lex.intake.saved": "intake.saved",
  "lex.intake.structured": "intake.structured",
  "lex.document.indexed": "document.indexed",
  "lex.brain.consolidated": "brain.consolidated",
  "lex.draft.generated": "draft.generated",
  "lex.review.completed": "review.completed",
  "lex.deadline.approaching": "deadline.approaching",
  "lex.message.inbound": "message.inbound",
};

const JUSTOS_TO_N8N: Record<string, string> = {
  "justos.case.created": "justos.case.created",
  "justos.crm.message.inbound": "justos.crm.message.inbound",
  "justos.deadline.approaching": "justos.deadline.approaching",
};

function toN8nEventName(event: string): string {
  if (JUSTOS_TO_N8N[event]) return JUSTOS_TO_N8N[event];
  if (LEX_TO_N8N[event]) return LEX_TO_N8N[event];
  if (event.startsWith("lex.")) return event.slice(4);
  return event;
}

export type JustosEventName = LexJustosEventName | `justos.${string}`;

export async function emitJustosEvent(args: {
  event: JustosEventName;
  workspaceId: string;
  caseId?: string;
  workspaceOnboardingJson?: unknown;
  title?: string;
  secretary?: N8nSecretaryPayload;
  allowedRecipients?: string[];
  sessionKey?: string;
  traceId?: string;
  extras?: Record<string, unknown>;
  meta?: Record<string, unknown>;
}): Promise<{ sent: boolean; skipped?: string }> {
  const config = readJustosWorkspaceConfig(args.workspaceOnboardingJson ?? {});
  const devEmit = process.env["JUSTOS_DEV_EMIT"] === "true";
  if (!config.enabled && !devEmit) return { sent: false, skipped: "justos_disabled" };

  const requiresPro = PRO_ONLY.has(args.event);
  if (requiresPro && !isJustosProActive(config)) {
    return { sent: false, skipped: "justos_pro_required" };
  }

  const url = readJustosN8nWebhookUrl();
  if (!url) return { sent: false, skipped: "no_webhook_url" };

  const traceId =
    args.traceId ??
    (args.caseId
      ? `justos_${args.caseId}_${Date.now()}`
      : `justos_ws_${args.workspaceId}_${Date.now()}`);

  const payload: LexJustosEventPayload = {
    event: args.event as LexJustosEventName,
    workspaceId: args.workspaceId,
    caseId: args.caseId,
    timestamp: new Date().toISOString(),
    requiresPro,
    meta: args.meta,
  };

  const secret = readJustosN8nWebhookSecret();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (secret) {
    headers["x-justos-n8n-secret"] = secret;
    headers["x-lex-n8n-secret"] = secret;
  }

  const n8nBody = {
    ...payload,
    event: toN8nEventName(args.event),
    title: args.title,
    secretary: args.secretary,
    allowedRecipients: args.allowedRecipients,
    sessionKey: args.sessionKey,
    workspaceId: args.workspaceId,
    traceId,
    extras: { ...args.extras, ...args.meta },
  };

  try {
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(n8nBody) });
    if (!res.ok) return { sent: false, skipped: `http_${res.status}` };
    return { sent: true };
  } catch {
    return { sent: false, skipped: "fetch_error" };
  }
}
