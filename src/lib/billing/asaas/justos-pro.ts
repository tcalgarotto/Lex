import {
  JUSTOS_PRO_PRICE_MONTHLY_BRL,
  JUSTOS_PRO_PRICE_YEARLY_BRL,
  type JustosProBillingCycle,
} from "@/lib/justos/billing";
import type { AsaasCustomer, AsaasPayment, AsaasSubscription } from "./types";
import { asaasRequest, isAsaasBillingConfigured } from "./client";

const SANDBOX_DEFAULT_CPF = "24971563792";

function cycleToAsaas(cycle: JustosProBillingCycle): "MONTHLY" | "YEARLY" {
  return cycle === "yearly" ? "YEARLY" : "MONTHLY";
}

function priceForCycle(cycle: JustosProBillingCycle): number {
  return cycle === "yearly" ? JUSTOS_PRO_PRICE_YEARLY_BRL : JUSTOS_PRO_PRICE_MONTHLY_BRL;
}

function formatDueDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function readDefaultCpf(): string {
  return process.env["ASAAS_SANDBOX_DEFAULT_CPF"]?.trim() || SANDBOX_DEFAULT_CPF;
}

/** JustOS Pro: apenas PIX ou cartão (boleto não é aceito). */
export type JustosAsaasBillingType = "PIX" | "CREDIT_CARD";

export type JustosPaymentMethod = "pix" | "credit_card";

export function paymentMethodToAsaasBillingType(
  method: JustosPaymentMethod | undefined,
): JustosAsaasBillingType {
  if (method === "pix") return "PIX";
  if (method === "credit_card") return "CREDIT_CARD";
  return readJustosAsaasBillingType();
}

export function readJustosAsaasBillingType(): JustosAsaasBillingType {
  const t = process.env["ASAAS_BILLING_TYPE"]?.trim().toUpperCase();
  if (t === "PIX") return "PIX";
  // UNDEFINED/BOLETO legados → cartão (evita "Pergunte ao cliente" com boleto)
  return "CREDIT_CARD";
}

export async function createAsaasCustomer(args: {
  name: string;
  email: string;
  cpfCnpj?: string;
  mobilePhone?: string;
  externalReference: string;
}): Promise<AsaasCustomer> {
  return asaasRequest<AsaasCustomer>({
    method: "POST",
    path: "/v3/customers",
    body: {
      name: args.name,
      email: args.email,
      cpfCnpj: args.cpfCnpj ?? readDefaultCpf(),
      mobilePhone: args.mobilePhone?.replace(/\D/g, "").slice(-11) || undefined,
      externalReference: args.externalReference,
    },
  });
}

export async function findAsaasCustomerByExternalRef(
  externalReference: string,
): Promise<AsaasCustomer | null> {
  const res = await asaasRequest<{ data: AsaasCustomer[] }>({
    method: "GET",
    path: `/v3/customers?externalReference=${encodeURIComponent(externalReference)}&limit=1`,
  });
  return res.data?.[0] ?? null;
}

export async function ensureAsaasCustomer(args: {
  workspaceId: string;
  name: string;
  email: string;
  phone?: string | null;
}): Promise<AsaasCustomer> {
  const ref = `justos_ws_${args.workspaceId}`;
  const existing = await findAsaasCustomerByExternalRef(ref);
  if (existing) return existing;
  return createAsaasCustomer({
    name: args.name,
    email: args.email,
    mobilePhone: args.phone ?? undefined,
    externalReference: ref,
  });
}

export async function createJustosProSubscription(args: {
  customerId: string;
  workspaceId: string;
  cycle: JustosProBillingCycle;
  paymentMethod?: JustosPaymentMethod;
}): Promise<AsaasSubscription> {
  const nextDue = new Date();
  nextDue.setDate(nextDue.getDate() + 1);

  return asaasRequest<AsaasSubscription>({
    method: "POST",
    path: "/v3/subscriptions",
    body: {
      customer: args.customerId,
      billingType: paymentMethodToAsaasBillingType(args.paymentMethod),
      value: priceForCycle(args.cycle),
      nextDueDate: formatDueDate(nextDue),
      cycle: cycleToAsaas(args.cycle),
      description: "JustOS Pro — assinatura escritório",
      externalReference: args.workspaceId,
    },
  });
}

export async function listSubscriptionPayments(subscriptionId: string): Promise<AsaasPayment[]> {
  const res = await asaasRequest<{ data: AsaasPayment[] }>({
    method: "GET",
    path: `/v3/payments?subscription=${encodeURIComponent(subscriptionId)}&limit=5&order=desc`,
  });
  return res.data ?? [];
}

export function resolvePaymentCheckoutUrl(payment: AsaasPayment | undefined): string | null {
  if (!payment) return null;
  return payment.invoiceUrl ?? payment.bankSlipUrl ?? null;
}

/** Remove assinatura e cobranças pendentes (uso imediato / limpeza). */
export async function cancelAsaasSubscription(subscriptionId: string): Promise<void> {
  await asaasRequest<unknown>({
    method: "DELETE",
    path: `/v3/subscriptions/${subscriptionId}`,
  });
}

/** Suspende renovações; cobrança atual já paga permanece válida no Asaas. */
export async function suspendAsaasSubscription(
  subscriptionId: string,
): Promise<AsaasSubscription> {
  return asaasRequest<AsaasSubscription>({
    method: "PUT",
    path: `/v3/subscriptions/${subscriptionId}`,
    body: { status: "INACTIVE" },
  });
}

export type StartJustosProCheckoutResult =
  | {
      mode: "asaas";
      customerId: string;
      subscriptionId: string;
      paymentId: string | null;
      paymentUrl: string | null;
      cycle: JustosProBillingCycle;
    }
  | { mode: "immediate"; cycle: JustosProBillingCycle };

export async function startJustosProCheckout(args: {
  workspaceId: string;
  workspaceName: string;
  ownerEmail: string;
  ownerPhone?: string | null;
  cycle: JustosProBillingCycle;
  onboardingJson?: unknown;
  forceNew?: boolean;
  paymentMethod?: JustosPaymentMethod;
}): Promise<StartJustosProCheckoutResult & { reused?: boolean }> {
  if (!isAsaasBillingConfigured()) {
    return { mode: "immediate", cycle: args.cycle };
  }

  const { createOrReuseJustosProSubscription } = await import("./subscription-reuse");
  const result = await createOrReuseJustosProSubscription({
    workspaceId: args.workspaceId,
    workspaceName: args.workspaceName,
    ownerEmail: args.ownerEmail,
    ownerPhone: args.ownerPhone,
    cycle: args.cycle,
    onboardingJson: args.onboardingJson ?? {},
    forceNew: args.forceNew,
    paymentMethod: args.paymentMethod,
  });

  return {
    mode: "asaas",
    customerId: result.customerId,
    subscriptionId: result.subscriptionId,
    paymentId: result.paymentId,
    paymentUrl: result.paymentUrl,
    cycle: result.cycle,
    reused: result.reused,
  };
}
