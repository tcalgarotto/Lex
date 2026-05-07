/**
 * Tipos canônicos para integrações operacionais do escritório.
 *
 * Princípios:
 * - Adapter pattern: cada integração externa expõe a mesma interface.
 * - Determinístico/auditável: nenhum side-effect implícito (LLM, rede)
 *   acontece sem `IntegrationContext` explícito.
 * - Multi-tenant: tudo escopado por `workspaceId`.
 * - Credenciais nunca em plaintext: o adapter consome `secretRef` + cofre.
 * - Idempotência: cada `IntegrationEvent` carrega `fingerprint` único.
 */

import type { IntegrationProvider } from "@prisma/client";

export type IntegrationContext = {
  workspaceId: string;
  /** Referência opaca a credenciais (env var, vault key). Nunca o segredo cru. */
  secretRef?: string | null;
  /** Configuração não sensível (UF, OAB, tribunal, filtros). */
  config?: Record<string, unknown> | null;
  /** TraceID propagável para logs/observabilidade. */
  traceId?: string;
};

export type IntegrationHealth = {
  ok: boolean;
  /** Mensagem amigável para UI. */
  message: string;
  /** Código curto p/ telemetria (ex.: "MISSING_SECRET", "AUTH_OK", "RATE_LIMITED"). */
  code?: string;
  checkedAt: string;
};

export type IntegrationEventKind =
  | "PROCESS_MOVEMENT"
  | "PUBLICATION"
  | "INTIMATION"
  | "DEADLINE"
  | "MESSAGE_INBOUND"
  | "MESSAGE_OUTBOUND"
  | "DELIVERY_RECEIPT"
  | "WEBHOOK"
  | "SYSTEM";

export type IntegrationEvent = {
  /** Identificador determinístico p/ idempotência (sha-like). */
  fingerprint: string;
  provider: IntegrationProvider;
  kind: IntegrationEventKind;
  /** Título curto p/ timeline / notificação. */
  title: string;
  /** Texto longo / corpo do evento. */
  body: string;
  /** Quando o evento aconteceu de fato (não quando foi capturado). */
  occurredAt: string;
  /** Linka opcionalmente a um caso (process number / oab / cnpj match). */
  caseRef?: {
    processNumber?: string | null;
    tribunalCode?: string | null;
    uf?: string | null;
  };
  payload?: Record<string, unknown>;
};

export type FetchEventsArgs = {
  /** Marca d'água: só trazer eventos posteriores a este timestamp ISO. */
  since?: string;
  /** Limite operacional. */
  limit?: number;
};

export type SendMessageArgs = {
  /** Identificador do destinatário (e-mail, número, etc). */
  to: string;
  /** Assunto (e-mail) ou título (push). */
  subject?: string;
  /** Corpo em texto. */
  body: string;
  /** Mídia opcional. */
  attachments?: Array<{ filename: string; mimeType: string; bytes: number }>;
  /** Metadados livres. */
  metadata?: Record<string, unknown>;
};

export type SendMessageResult = {
  ok: boolean;
  /** ID externo retornado pelo provider (quando aplicável). */
  externalId?: string;
  message: string;
  fingerprint: string;
};

export type CalendarEvent = {
  id: string;
  title: string;
  /** ISO start. */
  start: string;
  /** ISO end. Para all-day events, igual a start + 1 dia. */
  end: string;
  description?: string;
  location?: string;
  /** UID estável p/ ICS / sync externo. */
  uid?: string;
};

/**
 * Contrato base implementado por todos os adapters.
 *
 * Nem todos os métodos são suportados por todo provider:
 * - Tribunais (PJe/e-SAJ/Projudi/EPROC) → `fetchEvents` (movimentações).
 * - Diário Oficial → `fetchEvents` (publicações).
 * - Email/WhatsApp → `sendMessage`, opcional `fetchEvents` (inbound).
 * - Calendar → `listCalendarEvents`, `createCalendarEvent`.
 *
 * Métodos não suportados retornam erro determinístico claro.
 */
export interface IntegrationAdapter {
  readonly provider: IntegrationProvider;

  /** Diagnóstico rápido (sem efeito colateral). */
  health(ctx: IntegrationContext): Promise<IntegrationHealth>;

  /** Coletar eventos novos (movimentações, publicações, mensagens). */
  fetchEvents?(
    ctx: IntegrationContext,
    args: FetchEventsArgs,
  ): Promise<IntegrationEvent[]>;

  /** Enviar mensagem outbound (e-mail / whatsapp). */
  sendMessage?(
    ctx: IntegrationContext,
    args: SendMessageArgs,
  ): Promise<SendMessageResult>;

  /** Listar eventos de calendário (intervalo). */
  listCalendarEvents?(
    ctx: IntegrationContext,
    args: { from: string; to: string },
  ): Promise<CalendarEvent[]>;

  /** Criar evento de calendário (retorna UID). */
  createCalendarEvent?(
    ctx: IntegrationContext,
    event: CalendarEvent,
  ): Promise<{ uid: string; ok: boolean }>;
}

/**
 * Erro tipado lançado por adapters quando uma operação não é suportada
 * ou faltam credenciais.
 */
export class IntegrationError extends Error {
  readonly code:
    | "NOT_SUPPORTED"
    | "MISSING_SECRET"
    | "INVALID_CONFIG"
    | "UPSTREAM"
    | "RATE_LIMITED"
    | "TIMEOUT";

  readonly upstream?: unknown;

  constructor(code: IntegrationError["code"], message: string, upstream?: unknown) {
    super(message);
    this.name = "IntegrationError";
    this.code = code;
    this.upstream = upstream;
  }
}
