import type { JustosCaseFlags, JustosProBillingCycle, JustosProSubscriptionStatus, JustosWorkspaceConfig } from "./types";
import { DEFAULT_JUSTOS_WORKSPACE } from "./types";

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** Lê `onboardingJson.justos` do workspace. */
export function readJustosWorkspaceConfig(onboardingJson: unknown): JustosWorkspaceConfig {
  const root = asRecord(onboardingJson);
  const j = asRecord(root["justos"]);
  return {
    enabled: Boolean(j["enabled"]),
    proEnabled: Boolean(j["proEnabled"]),
    proBillingCycle:
      j["proBillingCycle"] === "monthly" || j["proBillingCycle"] === "yearly"
        ? (j["proBillingCycle"] as JustosProBillingCycle)
        : undefined,
    proSubscriptionStatus: isProStatus(j["proSubscriptionStatus"])
      ? (j["proSubscriptionStatus"] as JustosProSubscriptionStatus)
      : undefined,
    proSubscribedAt: typeof j["proSubscribedAt"] === "string" ? j["proSubscribedAt"] : undefined,
    proRenewsAt: typeof j["proRenewsAt"] === "string" ? j["proRenewsAt"] : undefined,
    proCancelAtPeriodEnd: j["proCancelAtPeriodEnd"] === true,
    proAccessUntil:
      typeof j["proAccessUntil"] === "string" ? j["proAccessUntil"] : undefined,
    allowedNumbers: Array.isArray(j["allowedNumbers"])
      ? j["allowedNumbers"].filter((n): n is string => typeof n === "string")
      : undefined,
    officePhone: typeof j["officePhone"] === "string" ? j["officePhone"] : undefined,
    lawyerWhatsApp: Array.isArray(j["lawyerWhatsApp"])
      ? j["lawyerWhatsApp"].filter((n): n is string => typeof n === "string")
      : undefined,
    n8nHealthUrl: typeof j["n8nHealthUrl"] === "string" ? j["n8nHealthUrl"] : undefined,
    lastNotificationAt:
      typeof j["lastNotificationAt"] === "string" ? j["lastNotificationAt"] : undefined,
    asaasCustomerId: typeof j["asaasCustomerId"] === "string" ? j["asaasCustomerId"] : undefined,
    asaasSubscriptionId:
      typeof j["asaasSubscriptionId"] === "string" ? j["asaasSubscriptionId"] : undefined,
    asaasPaymentUrl: typeof j["asaasPaymentUrl"] === "string" ? j["asaasPaymentUrl"] : undefined,
    asaasPaymentId: typeof j["asaasPaymentId"] === "string" ? j["asaasPaymentId"] : undefined,
  };
}

export function mergeJustosWorkspaceConfig(
  onboardingJson: unknown,
  patch: Partial<JustosWorkspaceConfig>,
): Record<string, unknown> {
  const root = asRecord(onboardingJson);
  const current = readJustosWorkspaceConfig(onboardingJson);
  return {
    ...root,
    justos: { ...current, ...patch },
  };
}

export function isJustosOperational(config: JustosWorkspaceConfig): boolean {
  return config.enabled;
}

/** Período pago ainda válido após cancelamento (até próxima data de cobrança). */
export function isJustosProAccessValid(config: JustosWorkspaceConfig): boolean {
  if (!config.proCancelAtPeriodEnd) return true;
  const until = config.proAccessUntil ?? config.proRenewsAt;
  if (!until) return false;
  return Date.now() < new Date(until).getTime();
}

export function isJustosProActive(config: JustosWorkspaceConfig): boolean {
  if (!config.enabled || !config.proEnabled) return false;
  if (config.proSubscriptionStatus === "cancelled") return false;
  if (config.proCancelAtPeriodEnd && !isJustosProAccessValid(config)) return false;
  return true;
}

function isProStatus(v: unknown): v is JustosProSubscriptionStatus {
  return (
    v === "inactive" ||
    v === "active" ||
    v === "trialing" ||
    v === "past_due" ||
    v === "cancelled"
  );
}

/** Flags por caso em `Case.metadataJson.justos`. */
export function readJustosCaseFlags(metadataJson: unknown): JustosCaseFlags {
  const m = asRecord(metadataJson);
  const j = asRecord(m["justos"]);
  return {
    whatsappNotify: j["whatsappNotify"] === true,
    clientPhoneRef: typeof j["clientPhoneRef"] === "string" ? j["clientPhoneRef"] : undefined,
  };
}

export function mergeJustosCaseFlags(
  metadataJson: unknown,
  patch: Partial<JustosCaseFlags>,
): Record<string, unknown> {
  const m = asRecord(metadataJson);
  const current = readJustosCaseFlags(metadataJson);
  return {
    ...m,
    justos: { ...current, ...patch },
  };
}

export { DEFAULT_JUSTOS_WORKSPACE };
