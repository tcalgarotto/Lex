import type { User as AuthUser } from "@supabase/supabase-js";
import { MembershipRole, WorkspaceLicense, Prisma } from "@prisma/client";
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
    // Slug único por utilizador (UUID sem hífens). O antigo `ws-` + 8 chars colidia
    // com estado órfão ou colisão rara de prefixo entre contas.
    const slug = `ws-${user.id.replace(/-/g, "")}`;
    let workspace = await prisma.workspace.findUnique({ where: { slug } });
    if (!workspace) {
      try {
        workspace = await prisma.workspace.create({
          data: {
            name: "Meu workspace",
            slug,
            license: WorkspaceLicense.SOLO,
          },
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          workspace = await prisma.workspace.findUniqueOrThrow({ where: { slug } });
        } else {
          throw e;
        }
      }
    }
    membership = await prisma.membership.upsert({
      where: {
        workspaceId_userId: { workspaceId: workspace.id, userId: user.id },
      },
      create: {
        workspaceId: workspace.id,
        userId: user.id,
        role: MembershipRole.OWNER,
      },
      update: {},
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
