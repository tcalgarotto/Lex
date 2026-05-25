import type { JustosProBillingCycle } from "./billing";
import { estimateJustosProRenewal } from "./billing";
import type { JustosWorkspaceConfig } from "./types";
import { mergeJustosWorkspaceConfig } from "./workspace-config";

/** Ativa assinatura Pro no workspace (webhook Asaas ou modo imediato). */
export function buildJustosProSubscriptionPatch(
  cycle: JustosProBillingCycle,
): Partial<JustosWorkspaceConfig> {
  const now = new Date();
  const subscribedAt = now.toISOString();
  const renewsAt = estimateJustosProRenewal(subscribedAt, cycle).toISOString();
  return {
    enabled: true,
    proEnabled: true,
    proBillingCycle: cycle,
    proSubscriptionStatus: "active",
    proSubscribedAt: subscribedAt,
    proRenewsAt: renewsAt,
    proCancelAtPeriodEnd: false,
    proAccessUntil: undefined,
  };
}

/** Revoga Pro imediatamente (fim do período ou exclusão no Asaas). */
export function buildJustosProCancelPatch(): Partial<JustosWorkspaceConfig> {
  return {
    proEnabled: false,
    proSubscriptionStatus: "cancelled",
    proCancelAtPeriodEnd: false,
    proAccessUntil: undefined,
    asaasCustomerId: undefined,
    asaasSubscriptionId: undefined,
    asaasPaymentUrl: undefined,
    asaasPaymentId: undefined,
  };
}

/** Cancela renovação; usuário mantém Pro até `accessUntil` (período já pago). */
export function buildJustosProCancelAtPeriodEndPatch(args: {
  accessUntilIso: string;
  asaasSubscriptionId?: string;
  asaasCustomerId?: string;
}): Partial<JustosWorkspaceConfig> {
  return {
    enabled: true,
    proEnabled: true,
    proSubscriptionStatus: "active",
    proCancelAtPeriodEnd: true,
    proAccessUntil: args.accessUntilIso,
    proRenewsAt: args.accessUntilIso,
    asaasSubscriptionId: args.asaasSubscriptionId,
    asaasCustomerId: args.asaasCustomerId,
    asaasPaymentUrl: undefined,
    asaasPaymentId: undefined,
  };
}

export function mergeJustosSubscription(
  onboardingJson: unknown,
  patch: Partial<JustosWorkspaceConfig>,
): Record<string, unknown> {
  return mergeJustosWorkspaceConfig(onboardingJson, patch);
}
