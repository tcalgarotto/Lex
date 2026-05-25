import type { JustosProSubscriptionStatus, JustosWorkspaceConfig } from "./types";
import { isJustosProAccessValid, isJustosProActive } from "./workspace-config";

export type JustosProEntitlement = {
  active: boolean;
  reason?: string;
  status?: JustosProSubscriptionStatus;
  pendingPayment?: boolean;
};

const PAID_STATUSES = new Set<JustosProSubscriptionStatus>(["active", "trialing"]);

/**
 * Direito ao JustOS Pro CRM / secretária.
 * Com Asaas: Pro ativo após `PAYMENT_RECEIVED` / `PAYMENT_CONFIRMED` (webhook).
 * Dev sem Asaas: `ASAAS_BILLING_MODE=immediate` ou `JUSTOS_PRO_DEV_BYPASS=true`.
 */
export function getJustosProEntitlement(config: JustosWorkspaceConfig): JustosProEntitlement {
  if (!config.enabled) {
    return {
      active: false,
      reason: "JustOS não está ativado neste escritório.",
      status: config.proSubscriptionStatus,
    };
  }

  if (config.proSubscriptionStatus === "cancelled") {
    return {
      active: false,
      reason: "Assinatura JustOS Pro encerrada.",
      status: "cancelled",
    };
  }

  if (config.proCancelAtPeriodEnd && !isJustosProAccessValid(config)) {
    return {
      active: false,
      reason: "Período contratado do JustOS Pro encerrou.",
      status: "cancelled",
    };
  }

  if (config.proCancelAtPeriodEnd && isJustosProAccessValid(config)) {
    const until = config.proAccessUntil ?? config.proRenewsAt;
    const untilLabel = until
      ? new Date(until).toLocaleDateString("pt-BR")
      : "o fim do período";
    return {
      active: true,
      reason: `Renovação cancelada — acesso até ${untilLabel}.`,
      status: "active",
    };
  }

  const pendingPayment =
    Boolean(config.asaasSubscriptionId) &&
    !config.proEnabled &&
    config.proSubscriptionStatus === "inactive";

  if (pendingPayment) {
    return {
      active: false,
      reason: "Aguardando confirmação de pagamento no Asaas.",
      status: "inactive",
      pendingPayment: true,
    };
  }

  if (!config.proEnabled) {
    return {
      active: false,
      reason: "Assinatura JustOS Pro não contratada.",
      status: config.proSubscriptionStatus,
    };
  }

  const status = config.proSubscriptionStatus;
  if (status && !PAID_STATUSES.has(status) && status !== "past_due") {
    if (status === "inactive" && process.env["JUSTOS_PRO_DEV_BYPASS"] === "true") {
      return { active: true, status };
    }
    if (status === "inactive") {
      return {
        active: false,
        reason: "Aguardando confirmação de pagamento (Asaas).",
        status,
      };
    }
  }

  if (isJustosProActive(config)) {
    return { active: true, status: status ?? "active" };
  }

  if (config.proEnabled && status === "past_due") {
    return {
      active: true,
      reason: "Pagamento em atraso — regularize no Asaas.",
      status: "past_due",
    };
  }

  return { active: false, reason: "JustOS Pro indisponível.", status };
}

export function syncJustosProFromAsaasEvent(_event: unknown): { ok: boolean; pending: true } {
  return { ok: false, pending: true };
}
