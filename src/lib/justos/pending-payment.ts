import { prisma } from "@/lib/prisma";
import { getAsaasPayment } from "@/lib/billing/asaas/embedded-payment";
import { readJustosWorkspaceConfig } from "./workspace-config";

export type PendingJustosPaymentContext = {
  paymentId: string;
  subscriptionId: string | undefined;
  customerId: string | undefined;
};

export async function resolvePendingJustosPayment(
  workspaceId: string,
): Promise<PendingJustosPaymentContext | null> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { onboardingJson: true },
  });
  const cfg = readJustosWorkspaceConfig(ws?.onboardingJson);
  if (!cfg.asaasPaymentId) return null;

  const payment = await getAsaasPayment(cfg.asaasPaymentId);
  if (payment && !["PENDING", "OVERDUE"].includes(payment.status)) {
    return null;
  }

  return {
    paymentId: cfg.asaasPaymentId,
    subscriptionId: cfg.asaasSubscriptionId,
    customerId: cfg.asaasCustomerId,
  };
}
