import { getAsaasPayment } from "@/lib/billing/asaas/embedded-payment";
import type { AsaasPayment } from "@/lib/billing/asaas/types";
import { prisma } from "@/lib/prisma";
import { readJustosWorkspaceConfig } from "./workspace-config";
import {
  buildJustosProSubscriptionPatch,
  mergeJustosSubscription,
} from "./subscription-store";
import type { JustosProBillingCycle } from "./types";

const PAID_STATUSES = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);

export function isAsaasPaymentPaid(status: string): boolean {
  return PAID_STATUSES.has(status);
}

/** Ativa Pro localmente quando o Asaas já marcou a cobrança como paga (sem esperar webhook). */
export async function activateJustosProFromAsaasPayment(
  workspaceId: string,
  payment: AsaasPayment,
): Promise<{ activated: boolean; status: string; message: string }> {
  if (!isAsaasPaymentPaid(payment.status)) {
    return {
      activated: false,
      status: payment.status,
      message: `Cobrança ainda ${payment.status} no Asaas. No Sandbox Pix, use "Confirmar pagamento" no painel Asaas.`,
    };
  }

  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { onboardingJson: true },
  });
  if (!ws) {
    return { activated: false, status: payment.status, message: "Workspace não encontrado." };
  }

  const current = readJustosWorkspaceConfig(ws.onboardingJson);
  const cycle = (current.proBillingCycle ?? "monthly") as JustosProBillingCycle;

  const onboardingJson = mergeJustosSubscription(ws.onboardingJson, {
    ...buildJustosProSubscriptionPatch(cycle),
    asaasCustomerId: current.asaasCustomerId ?? payment.customer,
    asaasSubscriptionId:
      current.asaasSubscriptionId ?? payment.subscription ?? undefined,
    asaasPaymentId: payment.id,
    asaasPaymentUrl: undefined,
    proSubscriptionStatus: "active",
  });

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { onboardingJson: onboardingJson as object },
  });

  return {
    activated: true,
    status: payment.status,
    message: "JustOS Pro ativado.",
  };
}

/** Consulta status no Asaas e ativa Pro se já pago (útil sem tunnel de webhook). */
export async function syncJustosPaymentFromAsaas(
  workspaceId: string,
  paymentId: string,
): Promise<{ activated: boolean; status: string; message: string }> {
  const payment = await getAsaasPayment(paymentId);
  if (!payment) {
    return {
      activated: false,
      status: "UNKNOWN",
      message: "Cobrança não encontrada no Asaas.",
    };
  }
  return activateJustosProFromAsaasPayment(workspaceId, payment);
}
