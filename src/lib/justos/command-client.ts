import type { JustosCommandSendRequest, JustosWaSendResult } from "./command-contracts";
import { readJustosCommandSecret, readJustosCommandUrl } from "./env";

export type CommandSessionStatus = {
  workspaceId: string;
  sessionKey: string;
  status: string;
  phoneE164?: string | null;
  openclawPort?: number | null;
  qrAvailable?: boolean;
  commandReachable?: boolean;
  openclawMode?: string;
  lastHealthAt?: string | null;
  error?: string | null;
};

export type CommandQrResponse = {
  qrAvailable: boolean;
  qrText?: string | null;
  dataUrl?: string | null;
  status: string;
};

function baseUrl(): string {
  return (readJustosCommandUrl() ?? "http://127.0.0.1:3301").replace(/\/$/, "");
}

function commandHeaders(workspaceId: string, sessionKey?: string, traceId?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-justos-workspace-id": workspaceId,
  };
  const secret = readJustosCommandSecret();
  if (secret) headers["x-justos-command-secret"] = secret;
  if (sessionKey) headers["x-justos-session-key"] = sessionKey;
  if (traceId) headers["x-justos-trace-id"] = traceId;
  return headers;
}

export async function pingJustosCommandHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl()}/health`, { signal: AbortSignal.timeout(3_000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchCommandSessionStatus(
  workspaceId: string,
  sessionKey: string,
): Promise<CommandSessionStatus | null> {
  try {
    const res = await fetch(`${baseUrl()}/sessions/${workspaceId}/status`, {
      headers: commandHeaders(workspaceId, sessionKey),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    return (await res.json()) as CommandSessionStatus;
  } catch {
    return null;
  }
}

export async function connectCommandSession(
  workspaceId: string,
  sessionKey: string,
): Promise<CommandSessionStatus | null> {
  const res = await fetch(`${baseUrl()}/sessions/${workspaceId}/connect`, {
    method: "POST",
    headers: commandHeaders(workspaceId, sessionKey),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `Command connect HTTP ${res.status}`);
  }
  return (await res.json()) as CommandSessionStatus;
}

export async function disconnectCommandSession(
  workspaceId: string,
  sessionKey: string,
): Promise<void> {
  await fetch(`${baseUrl()}/sessions/${workspaceId}/disconnect`, {
    method: "POST",
    headers: commandHeaders(workspaceId, sessionKey),
    signal: AbortSignal.timeout(15_000),
  });
}

export async function fetchCommandQr(
  workspaceId: string,
  sessionKey: string,
): Promise<CommandQrResponse | null> {
  const res = await fetch(`${baseUrl()}/sessions/${workspaceId}/qr`, {
    headers: commandHeaders(workspaceId, sessionKey),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return null;
  return (await res.json()) as CommandQrResponse;
}

export async function sendJustosSelfTest(
  workspaceId: string,
  sessionKey: string,
  traceId?: string,
): Promise<JustosWaSendResult & { to?: string }> {
  const tid = traceId ?? crypto.randomUUID();
  try {
    const res = await fetch(`${baseUrl()}/sessions/${workspaceId}/send-test`, {
      method: "POST",
      headers: commandHeaders(workspaceId, sessionKey, tid),
      signal: AbortSignal.timeout(20_000),
    });
    const data = (await res.json()) as JustosWaSendResult & { error?: string; to?: string };
    if (!res.ok) {
      return {
        ok: false,
        status: "failed",
        error: data.error ?? `HTTP ${res.status}`,
        traceId: tid,
      };
    }
    return {
      ok: Boolean(data.ok),
      status: data.status ?? "sent",
      traceId: data.traceId ?? tid,
      error: data.error,
      to: data.to,
    };
  } catch (e) {
    return {
      ok: false,
      status: "failed",
      error: e instanceof Error ? e.message : "command_unreachable",
      traceId: tid,
    };
  }
}

export async function sendViaJustosCommand(
  req: JustosCommandSendRequest & { allowedRecipients?: string[] },
): Promise<JustosWaSendResult> {
  const headers = commandHeaders(req.workspaceId, req.sessionKey, req.traceId);

  try {
    const res = await fetch(`${baseUrl()}/whatsapp/send`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        workspaceId: req.workspaceId,
        sessionKey: req.sessionKey,
        to: req.to,
        body: req.message,
        caseId: req.caseId,
        allowedRecipients: req.allowedRecipients,
        traceId: req.traceId,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await res.json()) as JustosWaSendResult & { error?: string };
    if (!res.ok) {
      return {
        ok: false,
        status: "failed",
        error: data.error ?? `HTTP ${res.status}`,
        traceId: req.traceId,
      };
    }
    return {
      ok: Boolean(data.ok),
      status: data.status ?? "sent",
      traceId: data.traceId ?? req.traceId,
      error: data.error,
    };
  } catch (e) {
    return {
      ok: false,
      status: "failed",
      error: e instanceof Error ? e.message : "command_unreachable",
      traceId: req.traceId,
    };
  }
}
