import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { WORKSPACE_COOKIE } from "@/lib/constants";

export async function resolveWorkspaceId(userId: string): Promise<string> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(WORKSPACE_COOKIE)?.value;
  if (fromCookie) {
    const ok = await prisma.membership.findFirst({
      where: { userId, workspaceId: fromCookie },
    });
    if (ok) return fromCookie;
  }

  const m = await prisma.membership.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  if (!m) throw new Error("Usuário sem workspace.");
  return m.workspaceId;
}
