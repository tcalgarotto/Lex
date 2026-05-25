import { WorkspaceLicense } from "@prisma/client";

/**
 * O plano do workspace pode mudar a qualquer momento (upgrade/downgrade),
 * tipicamente **liberado na hora** após o pagamento ser confirmado.
 * A persistência é `Workspace.license` (+ `customSeatLimit` no empresarial).
 */

/** Rótulos em PT-BR para UI e e-mails. */
export const WORKSPACE_LICENSE_LABEL_PT: Record<WorkspaceLicense, string> = {
  [WorkspaceLicense.INVESTOR]: "Investidor",
  [WorkspaceLicense.SOLO]: "Solo",
  [WorkspaceLicense.DUO]: "Duo",
  [WorkspaceLicense.TEAM]: "Team",
  [WorkspaceLicense.ENTERPRISE]: "Empresarial",
};

/**
 * Limite de lugares (membros + convites PENDING não expirados) por licença.
 * `null` = ilimitado (ENTERPRISE sem `customSeatLimit` definido pela venda).
 */
export function workspaceLicenseSeatCap(
  license: WorkspaceLicense,
  customSeatLimit: number | null,
): number | null {
  switch (license) {
    case WorkspaceLicense.INVESTOR:
      return 3;
    case WorkspaceLicense.SOLO:
      return 1;
    case WorkspaceLicense.DUO:
      return 2;
    case WorkspaceLicense.TEAM:
      return 4;
    case WorkspaceLicense.ENTERPRISE:
      return customSeatLimit;
  }
}

/** `true` se a ocupação atual cabe no teto do plano indicado. */
export function workspaceWouldFitOccupancy(
  occupied: number,
  license: WorkspaceLicense,
  customSeatLimit: number | null,
): boolean {
  const cap = workspaceLicenseSeatCap(license, customSeatLimit);
  if (cap === null) return true;
  return occupied <= cap;
}

/**
 * Preço mensal de referência (BRL), a parametrizar com o comercial / Asaas.
 * Valor 0 = ainda não definido no produto.
 */
export const WORKSPACE_LICENSE_REFERENCE_PRICE_MONTHLY_BRL: Record<WorkspaceLicense, number> = {
  [WorkspaceLicense.INVESTOR]: 0,
  [WorkspaceLicense.SOLO]: 0,
  [WorkspaceLicense.DUO]: 0,
  [WorkspaceLicense.TEAM]: 0,
  [WorkspaceLicense.ENTERPRISE]: 0,
};
