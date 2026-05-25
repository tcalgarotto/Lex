/**
 * Contratos JustOS Command ↔ OpenClaw (Fase A/C).
 * Implementação do sidecar fica em local-ai-control/services/justos-command.
 */

export type JustosWorkspaceWhatsappSession = {
  workspaceId: string;
  sessionKey: string;
  status: "disconnected" | "pairing" | "connected" | "error";
  phoneE164?: string;
  openclawPort?: number;
};

export type JustosCommandSendRequest = {
  workspaceId: string;
  sessionKey: string;
  to: string;
  message: string;
  traceId?: string;
  caseId?: string;
  channel?: "lawyer" | "client";
};

export type JustosWaSendResult = {
  ok: boolean;
  status: "sent" | "failed" | "skipped";
  traceId?: string;
  error?: string;
};

export type JustosCommandInboundPayload = {
  workspaceId: string;
  sessionKey: string;
  from: string;
  message: string;
  externalChatId?: string;
  timestamp: string;
};
