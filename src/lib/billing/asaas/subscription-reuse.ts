import type { JustosProBillingCycle } from "@/lib/justos/billing";
import type { JustosPaymentMethod } from "./justos-pro";
import { readJustosWorkspaceConfig } from "@/lib/justos/workspace-config";
import { asaasRequest, readAsaasApiBaseUrl, isAsaasBillingConfigured } from "./client";
import type { AsaasSubscription } from "./types";
import {
  ensureAsaasCustomer,
  listSubscriptionPayments,
  resolvePaymentCheckoutUrl,
} from "./justos-pro";

const REUSABLE_SUB_STATUSES = new Set(["ACTIVE", "INACTIVE"]);
const PENDING_PAYMENT_STATUSES = new Set(["PENDING", "OVERDUE", "AWAITING_RISK_ANALYSIS"]);

export type ExistingSubscriptionState = {
  subscriptionId: string;
  customerId: string;
  subscriptionStatus: AsaasSubscription["status"];
  paymentUrl: string | null;
  paymentId: string | null;
  canReuse: boolean;
  reason: string;
};

export async function getAsaasSubscription(
  subscriptionId: string,
): Promise<AsaasSubscription | null> {
  try {
    return await asaasRequest<AsaasSubscription>({
      method: "GET",
      path: `/v3/subscriptions/${subscriptionId}`,
    });
  } catch {
    return null;
  }
}

async function buildSubscriptionState(args: {
  workspaceId: string;
  onboardingJson: unknown;
  sub: AsaasSubscription;
}): Promise<ExistingSubscriptionState> {
  const cfg = readJustosWorkspaceConfig(args.onboardingJson);
  const payments = await listSubscriptionPayments(args.sub.id);
  const pending = payments.find((p) => PENDING_PAYMENT_STATUSES.has(p.status));
  const paymentUrl =
    cfg.asaasSubscriptionId === args.sub.id
      ? (cfg.asaasPaymentUrl ??
        resolvePaymentCheckoutUrl(pending) ??
        resolvePaymentCheckoutUrl(payments[0]))
      : resolvePaymentCheckoutUrl(pending) ?? resolvePaymentCheckoutUrl(payments[0]);

  return {
    subscriptionId: args.sub.id,
    customerId: args.sub.customer,
    subscriptionStatus: args.sub.status,
    paymentUrl,
    paymentId: pending?.id ?? cfg.asaasPaymentId ?? payments[0]?.id ?? null,
    canReuse: REUSABLE_SUB_STATUSES.has(args.sub.status),
    reason: pending ? "pending_payment" : "subscription_exists",
  };
}

/** Evita 2ª assinatura (e 2º e-mail de cobrança) para o mesmo workspace. */
export async function findExistingAsaasSubscriptionForWorkspace(args: {
  workspaceId: string;
  onboardingJson: unknown;
}): Promise<ExistingSubscriptionState | null> {
  if (!isAsaasBillingConfigured()) return null;

  const cfg = readJustosWorkspaceConfig(args.onboardingJson);
  if (cfg.proSubscriptionStatus === "cancelled") return null;

  const remoteSubs = await listAsaasSubscriptionsForWorkspace(args.workspaceId);
  const reusable = remoteSubs.filter(
    (s) =>
      REUSABLE_SUB_STATUSES.has(s.status) &&
      (!s.externalReference || s.externalReference === args.workspaceId),
  );

  if (reusable.length > 0) {
    let chosen =
      (cfg.asaasSubscriptionId
        ? reusable.find((s) => s.id === cfg.asaasSubscriptionId)
        : undefined) ?? null;

    if (!chosen) {
      for (const s of reusable) {
        const payments = await listSubscriptionPayments(s.id);
        if (payments.some((p) => PENDING_PAYMENT_STATUSES.has(p.status))) {
          chosen = s;
          break;
        }
      }
      if (!chosen) chosen = reusable[reusable.length - 1]!;
    }

    const state = await buildSubscriptionState({
      workspaceId: args.workspaceId,
      onboardingJson: args.onboardingJson,
      sub: chosen,
    });
    return state.canReuse ? state : null;
  }

  if (!cfg.asaasSubscriptionId) return null;

  const sub = await getAsaasSubscription(cfg.asaasSubscriptionId);
  if (!sub) {
    if (cfg.asaasPaymentUrl) {
      return {
        subscriptionId: cfg.asaasSubscriptionId,
        customerId: cfg.asaasCustomerId ?? "",
        subscriptionStatus: "INACTIVE",
        paymentUrl: cfg.asaasPaymentUrl,
        paymentId: cfg.asaasPaymentId ?? null,
        canReuse: true,
        reason: "local_pending_url",
      };
    }
    return null;
  }

  if (sub.externalReference && sub.externalReference !== args.workspaceId) {
    return null;
  }

  const state = await buildSubscriptionState({
    workspaceId: args.workspaceId,
    onboardingJson: args.onboardingJson,
    sub,
  });
  if (!state.canReuse && sub.status === "EXPIRED") return null;
  return state.canReuse ? state : null;
}

export type ReuseCheckoutResult = {
  reused: boolean;
  customerId: string;
  subscriptionId: string;
  paymentId: string | null;
  paymentUrl: string | null;
  cycle: JustosProBillingCycle;
};

export async function createOrReuseJustosProSubscription(args: {
  workspaceId: string;
  workspaceName: string;
  ownerEmail: string;
  ownerPhone?: string | null;
  cycle: JustosProBillingCycle;
  onboardingJson: unknown;
  forceNew?: boolean;
  paymentMethod?: JustosPaymentMethod;
}): Promise<ReuseCheckoutResult> {
  if (!args.forceNew) {
    const existing = await findExistingAsaasSubscriptionForWorkspace({
      workspaceId: args.workspaceId,
      onboardingJson: args.onboardingJson,
    });
    if (existing?.canReuse) {
      return {
        reused: true,
        customerId: existing.customerId,
        subscriptionId: existing.subscriptionId,
        paymentId: existing.paymentId,
        paymentUrl: existing.paymentUrl,
        cycle: args.cycle,
      };
    }
  } else {
    const remote = await listAsaasSubscriptionsForWorkspace(args.workspaceId);
    for (const sub of remote) {
      if (REUSABLE_SUB_STATUSES.has(sub.status)) {
        await asaasRequest({ method: "DELETE", path: `/v3/subscriptions/${sub.id}` });
      }
    }
  }

  const customer = await ensureAsaasCustomer({
    workspaceId: args.workspaceId,
    name: args.workspaceName,
    email: args.ownerEmail,
    phone: args.ownerPhone,
  });

  const { createJustosProSubscription } = await import("./justos-pro");
  const subscription = await createJustosProSubscription({
    customerId: customer.id,
    workspaceId: args.workspaceId,
    cycle: args.cycle,
    paymentMethod: args.paymentMethod,
  });

  await cancelDuplicateWorkspaceSubscriptions({
    workspaceId: args.workspaceId,
    keepSubscriptionId: subscription.id,
    dryRun: false,
  });

  const payments = await listSubscriptionPayments(subscription.id);
  const pending = payments.find((p) => PENDING_PAYMENT_STATUSES.has(p.status));
  const first = pending ?? payments[0];

  return {
    reused: false,
    customerId: customer.id,
    subscriptionId: subscription.id,
    paymentId: first?.id ?? null,
    paymentUrl: resolvePaymentCheckoutUrl(first),
    cycle: args.cycle,
  };
}

/** Sandbox admin: lista assinaturas com externalReference = workspaceId */
export async function listAsaasSubscriptionsForWorkspace(
  workspaceId: string,
): Promise<AsaasSubscription[]> {
  const res = await asaasRequest<{ data: AsaasSubscription[] }>({
    method: "GET",
    path: `/v3/subscriptions?externalReference=${encodeURIComponent(workspaceId)}&limit=20`,
  });
  return res.data ?? [];
}

/** Cancela assinaturas duplicadas do mesmo workspace (1 assinatura = 1 e-mail de cobrança inicial). */
export async function cancelDuplicateWorkspaceSubscriptions(args: {
  workspaceId: string;
  keepSubscriptionId: string | null;
  dryRun: boolean;
}): Promise<{ cancelled: string[]; skipped: string[] }> {
  const subs = await listAsaasSubscriptionsForWorkspace(args.workspaceId);
  const cancelled: string[] = [];
  const skipped: string[] = [];

  for (const sub of subs) {
    if (args.keepSubscriptionId && sub.id === args.keepSubscriptionId) {
      skipped.push(sub.id);
      continue;
    }
    if (sub.status === "ACTIVE" || sub.status === "INACTIVE") {
      if (!args.dryRun) {
        await asaasRequest({ method: "DELETE", path: `/v3/subscriptions/${sub.id}` });
      }
      cancelled.push(sub.id);
    } else {
      skipped.push(sub.id);
    }
  }

  return { cancelled, skipped };
}

/** @deprecated use cancelDuplicateWorkspaceSubscriptions */
export async function cancelStaleSandboxSubscriptions(args: {
  workspaceId: string;
  keepSubscriptionId: string;
  dryRun: boolean;
}): Promise<{ cancelled: string[]; skipped: string[] }> {
  if (!readAsaasApiBaseUrl().includes("sandbox")) {
    throw new Error("cancelStaleSandboxSubscriptions só permitido em Sandbox.");
  }
  return cancelDuplicateWorkspaceSubscriptions(args);
}
