import type { JustosProBillingCycle, JustosProSubscriptionStatus } from "./types";
import type { AsaasWebhookEvent } from "@/lib/billing/asaas/types";
import {
  buildJustosProCancelPatch,
  buildJustosProSubscriptionPatch,
  mergeJustosSubscription,
} from "./subscription-store";
import { isJustosProAccessValid, readJustosWorkspaceConfig } from "./workspace-config";
import { prisma } from "@/lib/prisma";

const PAYMENT_ACTIVE = new Set([
  "PAYMENT_RECEIVED",
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED_IN_CASH",
]);
const PAYMENT_OVERDUE = new Set(["PAYMENT_OVERDUE"]);
const PAYMENT_CANCELLED = new Set([
  "PAYMENT_DELETED",
  "PAYMENT_REFUNDED",
  "PAYMENT_REFUND_IN_PROGRESS",
]);
const SUBSCRIPTION_INACTIVE = new Set(["SUBSCRIPTION_DELETED", "SUBSCRIPTION_INACTIVATED"]);
const PAYMENT_PENDING = new Set(["PAYMENT_CREATED", "PAYMENT_AWAITING_RISK_ANALYSIS"]);

export async function resolveWorkspaceIdFromAsaasEvent(
  event: AsaasWebhookEvent,
): Promise<string | null> {
  const subId = event.payment?.subscription ?? event.subscription?.id;
  const extRef = event.subscription?.externalReference ?? event.payment?.externalReference;

  if (typeof extRef === "string" && extRef.length >= 8 && !extRef.startsWith("cus_")) {
    return extRef;
  }

  if (!subId) return null;

  const rows = await prisma.workspace.findMany({
    select: { id: true, onboardingJson: true },
    take: 500,
  });
  for (const r of rows) {
    const cfg = readJustosWorkspaceConfig(r.onboardingJson);
    if (cfg.asaasSubscriptionId === subId) return r.id;
  }

  return null;
}

export async function applyAsaasWebhookToWorkspace(
  event: AsaasWebhookEvent,
): Promise<{ ok: boolean; workspaceId?: string; action?: string }> {
  const workspaceId = await resolveWorkspaceIdFromAsaasEvent(event);
  if (!workspaceId) {
    return { ok: false, action: "workspace_not_found" };
  }

  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { onboardingJson: true },
  });
  if (!ws) return { ok: false, action: "workspace_missing" };

  const current = readJustosWorkspaceConfig(ws.onboardingJson);
  let patch: Record<string, unknown> = {};
  let action = event.event;

  if (PAYMENT_ACTIVE.has(event.event)) {
    const cycle = (current.proBillingCycle ?? "monthly") as JustosProBillingCycle;
    patch = {
      ...buildJustosProSubscriptionPatch(cycle),
      asaasCustomerId: current.asaasCustomerId ?? event.payment?.customer,
      asaasSubscriptionId: current.asaasSubscriptionId ?? event.payment?.subscription ?? undefined,
      asaasPaymentId: event.payment?.id,
      asaasPaymentUrl: undefined,
      proSubscriptionStatus: "active" as JustosProSubscriptionStatus,
    };
    action = "pro_activated";
  } else if (PAYMENT_OVERDUE.has(event.event)) {
    patch = {
      enabled: true,
      proEnabled: true,
      proSubscriptionStatus: "past_due" as JustosProSubscriptionStatus,
    };
    action = "pro_past_due";
  } else if (SUBSCRIPTION_INACTIVE.has(event.event)) {
    if (current.proCancelAtPeriodEnd && isJustosProAccessValid(current)) {
      patch = {
        enabled: true,
        proEnabled: true,
        proSubscriptionStatus: "active",
        proCancelAtPeriodEnd: true,
        proAccessUntil: current.proAccessUntil ?? current.proRenewsAt,
      };
      action = "cancel_at_period_end";
    } else {
      patch = buildJustosProCancelPatch();
      action = "pro_cancelled";
    }
  } else if (PAYMENT_CANCELLED.has(event.event)) {
    patch = buildJustosProCancelPatch();
    action = "pro_cancelled";
  } else if (PAYMENT_PENDING.has(event.event) && event.payment) {
    const url = event.payment.invoiceUrl ?? event.payment.bankSlipUrl;
    patch = {
      enabled: true,
      proEnabled: false,
      proSubscriptionStatus: "inactive" as JustosProSubscriptionStatus,
      asaasPaymentId: event.payment.id,
      asaasPaymentUrl: url ?? undefined,
      asaasCustomerId: current.asaasCustomerId ?? event.payment.customer,
      asaasSubscriptionId: current.asaasSubscriptionId ?? event.payment.subscription ?? undefined,
    };
    action = "payment_pending";
  } else {
    return { ok: true, workspaceId, action: "ignored" };
  }

  const onboardingJson = mergeJustosSubscription(ws.onboardingJson, patch);
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { onboardingJson: onboardingJson as object },
  });

  return { ok: true, workspaceId, action };
}
