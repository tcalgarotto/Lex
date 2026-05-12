import { InvitationStatus, type WorkspaceLicense } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { workspaceLicenseSeatCap } from "@/lib/billing/workspace-license";

export class WorkspaceSeatLimitReachedError extends Error {
  readonly code = "WORKSPACE_SEAT_LIMIT" as const;

  constructor() {
    super(
      "Este workspace atingiu o limite de lugares do plano. Remova membros ou convites pendentes, ou faça upgrade.",
    );
    this.name = "WorkspaceSeatLimitReachedError";
  }
}

export type WorkspaceSeatSnapshot = {
  license: WorkspaceLicense;
  customSeatLimit: number | null;
  /** `null` = ilimitado */
  capacity: number | null;
  memberCount: number;
  /** Convites PENDING com `expiresAt` no futuro. */
  pendingInviteCount: number;
  occupied: number;
};

export async function getWorkspaceSeatSnapshot(workspaceId: string): Promise<WorkspaceSeatSnapshot> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { license: true, customSeatLimit: true },
  });
  if (!ws) {
    throw new Error("Workspace não encontrado.");
  }
  const now = new Date();
  const [memberCount, pendingInviteCount] = await Promise.all([
    prisma.membership.count({ where: { workspaceId } }),
    prisma.invitation.count({
      where: {
        workspaceId,
        status: InvitationStatus.PENDING,
        expiresAt: { gt: now },
      },
    }),
  ]);
  const capacity = workspaceLicenseSeatCap(ws.license, ws.customSeatLimit);
  return {
    license: ws.license,
    customSeatLimit: ws.customSeatLimit,
    capacity,
    memberCount,
    pendingInviteCount,
    occupied: memberCount + pendingInviteCount,
  };
}

/** Garante que ainda cabe um convite PENDING novo (não renovação do mesmo e-mail). */
export async function assertCanAddNewPendingInvitation(workspaceId: string): Promise<void> {
  const snap = await getWorkspaceSeatSnapshot(workspaceId);
  if (snap.capacity === null) return;
  if (snap.occupied >= snap.capacity) {
    throw new WorkspaceSeatLimitReachedError();
  }
}
