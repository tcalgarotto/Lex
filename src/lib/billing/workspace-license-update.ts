import { WorkspaceLicense } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getWorkspaceSeatSnapshot } from "@/lib/auth/workspace-seats";
import { workspaceWouldFitOccupancy } from "@/lib/billing/workspace-license";

/**
 * Troca de plano bloqueada: há mais membros + convites pendentes do que o novo teto permite.
 * Resolver removendo membros ou revogando/expirando convites antes de rebaixar.
 */
export class WorkspaceLicenseChangeBlockedError extends Error {
  readonly code = "WORKSPACE_LICENSE_CHANGE_BLOCKED" as const;

  constructor() {
    super(
      "Não é possível aplicar este plano: há mais pessoas (e convites pendentes) do que o limite do novo plano. Remova membros ou convites e tente de novo.",
    );
    this.name = "WorkspaceLicenseChangeBlockedError";
  }
}

/**
 * Aplica o plano contratado no workspace — usar após **pagamento confirmado** (webhook,
 * ação interna, etc.). Efeito **imediato** nos limites de convites e lugares.
 *
 * - `ENTERPRISE`: passe `customSeatLimit` (`null` = ilimitado até vendas fixar).
 * - Outros planos: `customSeatLimit` é ignorado e gravado como `null`.
 * - Se `license === ENTERPRISE` e `customSeatLimit` for `undefined`, mantém o valor já salvo.
 */
export async function setWorkspaceLicense(params: {
  workspaceId: string;
  license: WorkspaceLicense;
  customSeatLimit?: number | null;
}): Promise<void> {
  const existing = await prisma.workspace.findUnique({
    where: { id: params.workspaceId },
    select: { customSeatLimit: true },
  });
  if (!existing) {
    throw new Error("Workspace não encontrado.");
  }

  const nextCustom: number | null =
    params.license === WorkspaceLicense.ENTERPRISE
      ? params.customSeatLimit !== undefined
        ? params.customSeatLimit
        : existing.customSeatLimit
      : null;

  const snap = await getWorkspaceSeatSnapshot(params.workspaceId);
  if (!workspaceWouldFitOccupancy(snap.occupied, params.license, nextCustom)) {
    throw new WorkspaceLicenseChangeBlockedError();
  }

  await prisma.workspace.update({
    where: { id: params.workspaceId },
    data: {
      license: params.license,
      customSeatLimit: nextCustom,
    },
  });
}
