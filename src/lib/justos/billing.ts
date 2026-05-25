/**
 * JustOS Pro — preços e formatação (BRL).
 * Cobrança JustOS Pro via Asaas (Sandbox: https://api-sandbox.asaas.com).
 */

export type JustosProBillingCycle = "monthly" | "yearly";

export const JUSTOS_PRO_PRICE_MONTHLY_BRL = 129.9;
export const JUSTOS_PRO_PRICE_YEARLY_BRL = 1099;

export const JUSTOS_PRO_FEATURES = [
  "Secretária por automação (WhatsApp operacional)",
  "Lembretes de casos parados e prazos",
  "Avisos quando minuta, revisão ou Case Brain atualizam",
  "Números autorizados por escritório e por caso",
  "CRM: contatos, pipeline e conversas por escritório",
  "Trilha no JustOS Core — motor jurídico no plano base",
] as const;

export function formatJustosPriceBrl(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function justosProYearlySavingsBrl(): number {
  return JUSTOS_PRO_PRICE_MONTHLY_BRL * 12 - JUSTOS_PRO_PRICE_YEARLY_BRL;
}

export function justosProYearlySavingsPercent(): number {
  const full = JUSTOS_PRO_PRICE_MONTHLY_BRL * 12;
  if (full <= 0) return 0;
  return Math.round((justosProYearlySavingsBrl() / full) * 100);
}

/** Próxima renovação estimada a partir da data de assinatura. */
export function estimateJustosProRenewal(
  subscribedAtIso: string,
  cycle: JustosProBillingCycle,
): Date {
  const start = new Date(subscribedAtIso);
  const next = new Date(start);
  if (cycle === "yearly") {
    next.setFullYear(next.getFullYear() + 1);
  } else {
    next.setMonth(next.getMonth() + 1);
  }
  return next;
}
