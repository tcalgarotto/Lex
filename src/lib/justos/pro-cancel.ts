import { suspendAsaasSubscription } from "@/lib/billing/asaas/justos-pro";
import { getAsaasSubscription } from "@/lib/billing/asaas/subscription-reuse";
import { isAsaasBillingConfigured } from "@/lib/billing/asaas/client";
import type { JustosWorkspaceConfig } from "./types";
import {
  buildJustosProCancelAtPeriodEndPatch,
  buildJustosProCancelPatch,
  mergeJustosSubscription,
} from "./subscription-store";
import { isJustosProAccessValid, readJustosWorkspaceConfig } from "./workspace-config";
import { prisma } from "@/lib/prisma";

function endOfDayIso(iso: string): string {
  const d = new Date(iso);
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

async function resolveAccessUntilIso(
  cfg: JustosWorkspaceConfig,
): Promise<string> {
  if (cfg.proRenewsAt) return endOfDayIso(cfg.proRenewsAt);
  if (cfg.proAccessUntil) return endOfDayIso(cfg.proAccessUntil);

  if (cfg.asaasSubscriptionId && isAsaasBillingConfigured()) {
    const sub = await getAsaasSubscription(cfg.asaasSubscriptionId);
    if (sub?.nextDueDate) {
      return endOfDayIso(`${sub.nextDueDate}T12:00:00.000Z`);
    }
  }

  const fallback = new Date();
  fallback.setDate(fallback.getDate() + 30);
  return fallback.toISOString();
}

export type CancelJustosProResult = {
  accessUntil: string;
  immediate: boolean;
  message: string;
};

/** Cancela renovação; Pro permanece até o fim do período contratado. */
export async function cancelJustosProForWorkspace(
  workspaceId: string,
): Promise<CancelJustosProResult> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { onboardingJson: true },
  });
  const cfg = readJustosWorkspaceConfig(ws?.onboardingJson);

  if (!cfg.proEnabled && cfg.proSubscriptionStatus !== "active") {
    const onboardingJson = mergeJustosSubscription(
      ws?.onboardingJson,
      buildJustosProCancelPatch(),
    );
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { onboardingJson: onboardingJson as object },
    });
    return {
      accessUntil: new Date().toISOString(),
      immediate: true,
      message: "Assinatura já estava inativa.",
    };
  }

  const accessUntilIso = await resolveAccessUntilIso(cfg);

  if (cfg.asaasSubscriptionId && isAsaasBillingConfigured()) {
    try {
      await suspendAsaasSubscription(cfg.asaasSubscriptionId);
    } catch (e) {
      console.warn("[justos] suspend Asaas subscription:", e);
    }
  }

  const onboardingJson = mergeJustosSubscription(
    ws?.onboardingJson,
    buildJustosProCancelAtPeriodEndPatch({
      accessUntilIso,
      asaasSubscriptionId: cfg.asaasSubscriptionId,
      asaasCustomerId: cfg.asaasCustomerId,
    }),
  );
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { onboardingJson: onboardingJson as object },
  });

  const untilLabel = new Date(accessUntilIso).toLocaleDateString("pt-BR");
  return {
    accessUntil: accessUntilIso,
    immediate: false,
    message: `Renovação cancelada. Você mantém o JustOS Pro até ${untilLabel} (fim do período já pago).`,
  };
}

/** Aplica revogação imediata se o período de acesso após cancelamento expirou. */
export async function finalizeExpiredJustosProIfNeeded(
  workspaceId: string,
  onboardingJson: unknown,
): Promise<unknown> {
  const cfg = readJustosWorkspaceConfig(onboardingJson);
  if (!cfg.proCancelAtPeriodEnd) return onboardingJson;
  if (isJustosProAccessValid(cfg)) return onboardingJson;

  const updated = mergeJustosSubscription(onboardingJson, buildJustosProCancelPatch());
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { onboardingJson: updated as object },
  });
  return updated;
}
