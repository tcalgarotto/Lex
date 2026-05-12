import { cache } from "react";
import { cookies } from "next/headers";
import type { MembershipRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { WORKSPACE_COOKIE } from "@/lib/constants";

export type ActiveWorkspaceMembership = {
  workspaceId: string;
  role: MembershipRole;
};

/**
 * Uma ida ao Prisma: memberships do utilizador + escolha do workspace ativo (cookie ou primeiro).
 * Memoizado por request — `resolveWorkspaceId` e `getWorkspaceContextWithRole` partilham o mesmo resultado.
 */
export const getActiveWorkspaceMembership = cache(
  async (userId: string): Promise<ActiveWorkspaceMembership> => {
    const cookieStore = await cookies();
    const fromCookie = cookieStore.get(WORKSPACE_COOKIE)?.value;

    const memberships = await prisma.membership.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { workspaceId: true, role: true },
    });

    if (memberships.length === 0) {
      throw new Error("Usuário sem workspace.");
    }

    if (fromCookie) {
      const hit = memberships.find((m) => m.workspaceId === fromCookie);
      if (hit) return hit;
    }

    return memberships[0]!;
  },
);
