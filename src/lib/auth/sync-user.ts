import type { User as AuthUser } from "@supabase/supabase-js";
import { MembershipRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Sincroniza o usuário Supabase Auth com a tabela `User` e garante workspace + membership.
 */
export async function syncAuthUserToDatabase(authUser: AuthUser): Promise<{
  userId: string;
  workspaceId: string;
}> {
  const email = authUser.email ?? `${authUser.id}@unknown.local`;
  const md = authUser.user_metadata;
  const metaName = md && typeof md["full_name"] === "string" ? md["full_name"] : undefined;
  const metaAvatar = md && typeof md["avatar_url"] === "string" ? md["avatar_url"] : undefined;
  const user = await prisma.user.upsert({
    where: { id: authUser.id },
    create: {
      id: authUser.id,
      email,
      name: metaName,
      avatarUrl: metaAvatar,
    },
    update: {
      email,
      name: metaName,
      avatarUrl: metaAvatar,
    },
  });

  let membership = await prisma.membership.findFirst({
    where: { userId: user.id },
    include: { workspace: true },
  });

  if (!membership) {
    const slug = `ws-${user.id.slice(0, 8)}`;
    const workspace = await prisma.workspace.create({
      data: {
        name: "Meu escritório",
        slug,
      },
    });
    membership = await prisma.membership.create({
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        role: MembershipRole.OWNER,
      },
      include: { workspace: true },
    });

    await prisma.styleProfile.upsert({
      where: {
        workspaceId_userId: { workspaceId: workspace.id, userId: user.id },
      },
      create: {
        workspaceId: workspace.id,
        userId: user.id,
        profileJson: {
          formalidade: "alta",
          doutrina: "moderada",
          jurisprudencia: "moderada",
          tom: "tecnico",
          frases_recorrentes: [] as string[],
        },
        recurringPhrases: [],
        metricsJson: {},
      },
      update: {},
    });
  }

  return { userId: user.id, workspaceId: membership.workspaceId };
}
