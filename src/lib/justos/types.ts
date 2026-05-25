/**
 * JustOS — configuração de produto (workspace + caso).
 * Secretária proativa = JustOS Pro (billing separado).
 */

export type JustosPlan = "base" | "pro";

export type JustosProBillingCycle = "monthly" | "yearly";

export type JustosProSubscriptionStatus =
  | "inactive"
  | "active"
  | "trialing"
  | "past_due"
  | "cancelled";

export type JustosWorkspaceConfig = {
  /** Master switch do sidecar JustOS neste escritório. */
  enabled: boolean;
  /** JustOS Pro — secretária, lembretes, WhatsApp proativo. */
  proEnabled: boolean;
  /** Ciclo de cobrança Pro (quando assinado). */
  proBillingCycle?: JustosProBillingCycle;
  /** Status comercial da assinatura Pro. */
  proSubscriptionStatus?: JustosProSubscriptionStatus;
  /** ISO — início da assinatura Pro atual. */
  proSubscribedAt?: string;
  /** ISO — próxima renovação estimada. */
  proRenewsAt?: string;
  /** Cancelamento solicitado: Pro segue até `proAccessUntil`. */
  proCancelAtPeriodEnd?: boolean;
  /** ISO — fim do direito de uso após cancelamento (geralmente = próxima cobrança). */
  proAccessUntil?: string;
  /** Números autorizados (E.164) para inbound Command. */
  allowedNumbers?: string[];
  /** Telefone padrão do escritório (exibição / outbound). */
  officePhone?: string;
  /** WhatsApp do(s) advogado(s) padrão do escritório (E.164). */
  lawyerWhatsApp?: string[];
  /** URL health n8n (opcional, UI). */
  n8nHealthUrl?: string;
  /** Última notificação (read-only UI). */
  lastNotificationAt?: string;
  /** Cliente Asaas (`cus_*`). */
  asaasCustomerId?: string;
  /** Assinatura Asaas (`sub_*`). */
  asaasSubscriptionId?: string;
  /** URL da cobrança pendente (boleto/Pix/cartão). */
  asaasPaymentUrl?: string;
  /** ID da cobrança atual (`pay_*`). */
  asaasPaymentId?: string;
};

export const DEFAULT_JUSTOS_WORKSPACE: JustosWorkspaceConfig = {
  enabled: false,
  proEnabled: false,
};

export type JustosCaseFlags = {
  /** Opt-in WhatsApp para este caso (Pro). */
  whatsappNotify?: boolean;
  /** Telefone cliente vinculado (mascarado na UI). */
  clientPhoneRef?: string;
};

export type LexJustosEventName =
  | "lex.case.created"
  | "lex.intake.saved"
  | "lex.intake.structured"
  | "lex.document.indexed"
  | "lex.brain.consolidated"
  | "lex.draft.generated"
  | "lex.review.completed"
  | "lex.deadline.approaching"
  | "lex.message.inbound";

export type LexJustosEventPayload = {
  event: LexJustosEventName;
  workspaceId: string;
  caseId?: string;
  timestamp: string;
  /** Eventos de secretária exigem Pro. */
  requiresPro?: boolean;
  meta?: Record<string, unknown>;
};
