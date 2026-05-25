import { prisma } from "@/lib/prisma";
import { startJustosProCheckout } from "@/lib/billing/asaas/justos-pro";
import {
  isAsaasBillingConfigured,
  isAsaasBillingImmediateMode,
} from "@/lib/billing/asaas/client";
import type { JustosPaymentMethod } from "@/lib/billing/asaas/justos-pro";
import type { JustosProBillingCycle } from "./types";
import { buildJustosProSubscriptionPatch, mergeJustosSubscription } from "./subscription-store";
import { readJustosWorkspaceConfig } from "./workspace-config";

export type SubscribeJustosProResult = {
  config: ReturnType<typeof readJustosWorkspaceConfig>;
  message: string;
  paymentId?: string | null;
  paymentUrl?: string | null;
  pendingPayment?: boolean;
  reused?: boolean;
};

export async function subscribeJustosProForWorkspace(args: {
  workspaceId: string;
  cycle: JustosProBillingCycle;
  paymentMethod?: JustosPaymentMethod;
}): Promise<SubscribeJustosProResult> {
  const ws = await prisma.workspace.findUnique({
    where: { id: args.workspaceId },
    select: {
      id: true,
      name: true,
      onboardingJson: true,
      memberships: {
        where: { role: "OWNER" },
        take: 1,
        select: { user: { select: { email: true, name: true } } },
      },
    },
  });

  if (!ws) throw new Error("Workspace não encontrado.");

  const owner = ws.memberships[0]?.user;
  const ownerEmail = owner?.email ?? `owner+${args.workspaceId}@justos.local`;
  const useImmediate = isAsaasBillingImmediateMode() || !isAsaasBillingConfigured();

  if (useImmediate) {
    const onboardingJson = mergeJustosSubscription(
      ws.onboardingJson,
      buildJustosProSubscriptionPatch(args.cycle),
    );
    await prisma.workspace.update({
      where: { id: args.workspaceId },
      data: { onboardingJson: onboardingJson as object },
    });
    return {
      config: readJustosWorkspaceConfig(onboardingJson),
      message: "JustOS Pro ativado (modo imediato — sem Asaas).",
      pendingPayment: false,
    };
  }

  const existingCfg = readJustosWorkspaceConfig(ws.onboardingJson);

  const checkout = await startJustosProCheckout({
    workspaceId: args.workspaceId,
    workspaceName: ws.name,
    ownerEmail,
    ownerPhone: existingCfg.officePhone ?? null,
    cycle: args.cycle,
    onboardingJson: ws.onboardingJson,
    forceNew: false,
    paymentMethod: args.paymentMethod,
  });

  if (checkout.mode === "immediate") {
    const onboardingJson = mergeJustosSubscription(
      ws.onboardingJson,
      buildJustosProSubscriptionPatch(args.cycle),
    );
    await prisma.workspace.update({
      where: { id: args.workspaceId },
      data: { onboardingJson: onboardingJson as object },
    });
    return {
      config: readJustosWorkspaceConfig(onboardingJson),
      message: "JustOS Pro ativado.",
      pendingPayment: false,
    };
  }

  const onboardingJson = mergeJustosSubscription(ws.onboardingJson, {
    enabled: true,
    proEnabled: false,
    proBillingCycle: checkout.cycle,
    proSubscriptionStatus: "inactive",
    asaasCustomerId: checkout.customerId,
    asaasSubscriptionId: checkout.subscriptionId,
    asaasPaymentId: checkout.paymentId ?? undefined,
    asaasPaymentUrl: checkout.paymentUrl ?? undefined,
  });
  const root = onboardingJson as Record<string, unknown>;
  const justos = (root["justos"] ?? {}) as Record<string, unknown>;
  justos["billingMetadata"] = {
    provider: "asaas",
    billingCycle: checkout.cycle,
    createdAt: new Date().toISOString(),
  };
  root["justos"] = justos;

  await prisma.workspace.update({
    where: { id: args.workspaceId },
    data: { onboardingJson: onboardingJson as object },
  });

  const reused = Boolean("reused" in checkout && checkout.reused);
  return {
    config: readJustosWorkspaceConfig(onboardingJson),
    message: reused
      ? "Cobrança pendente — conclua o pagamento abaixo (Pix ou cartão)."
      : "Assinatura criada. Conclua o pagamento abaixo para ativar o JustOS Pro.",
    paymentId: checkout.paymentId,
    paymentUrl: checkout.paymentUrl,
    pendingPayment: true,
    reused,
  };
}

export async function subscribeJustosProForceNew(args: {
  workspaceId: string;
  cycle: JustosProBillingCycle;
  paymentMethod?: JustosPaymentMethod;
}): Promise<SubscribeJustosProResult> {
  const ws = await prisma.workspace.findUnique({
    where: { id: args.workspaceId },
    select: {
      id: true,
      name: true,
      onboardingJson: true,
      memberships: {
        where: { role: "OWNER" },
        take: 1,
        select: { user: { select: { email: true, name: true } } },
      },
    },
  });
  if (!ws) throw new Error("Workspace não encontrado.");
  const owner = ws.memberships[0]?.user;
  const checkout = await startJustosProCheckout({
    workspaceId: args.workspaceId,
    workspaceName: ws.name,
    ownerEmail: owner?.email ?? `owner+${args.workspaceId}@justos.local`,
    ownerPhone: readJustosWorkspaceConfig(ws.onboardingJson).officePhone ?? null,
    cycle: args.cycle,
    onboardingJson: ws.onboardingJson,
    forceNew: true,
    paymentMethod: args.paymentMethod,
  });
  if (checkout.mode !== "asaas") {
    return subscribeJustosProForWorkspace({ workspaceId: args.workspaceId, cycle: args.cycle });
  }
  const onboardingJson = mergeJustosSubscription(ws.onboardingJson, {
    enabled: true,
    proEnabled: false,
    proBillingCycle: checkout.cycle,
    proSubscriptionStatus: "inactive",
    asaasCustomerId: checkout.customerId,
    asaasSubscriptionId: checkout.subscriptionId,
    asaasPaymentId: checkout.paymentId ?? undefined,
    asaasPaymentUrl: checkout.paymentUrl ?? undefined,
  });
  await prisma.workspace.update({
    where: { id: args.workspaceId },
    data: { onboardingJson: onboardingJson as object },
  });
  return {
    config: readJustosWorkspaceConfig(onboardingJson),
    message: "Nova cobrança gerada. Pague abaixo (Pix ou cartão).",
    paymentId: checkout.paymentId,
    paymentUrl: checkout.paymentUrl,
    pendingPayment: true,
  };
}

export { cancelJustosProForWorkspace } from "./pro-cancel";
export type { CancelJustosProResult } from "./pro-cancel";
