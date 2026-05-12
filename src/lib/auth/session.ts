import { cache } from "react";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { syncAuthUserToDatabase } from "@/lib/auth/sync-user";
import { resolveWorkspaceId } from "@/lib/auth/workspace";
import { prisma } from "@/lib/prisma";
import type { MembershipRole } from "@prisma/client";
import { can, type PermissionKey } from "@/lib/auth/permissions";
import type { WorkspaceOption } from "@/components/app/workspace-switcher";

export const getAuthUser = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * Garante `User` + workspace padrão + `Membership` no Prisma (primeiro acesso ou
 * conta criada fora do fluxo `/auth/callback`). Idempotente; memoizado por request.
 */
export const getAuthUserAndSync = cache(async () => {
  const user = await getAuthUser();
  if (!user) return null;
  await syncAuthUserToDatabase(user);
  return user;
});

export const requireAuthUser = cache(async () => {
  const user = await getAuthUserAndSync();
  if (!user) throw new Error("Não autenticado");
  return user;
});

export const getWorkspaceContext = cache(async () => {
  const user = await requireAuthUser();
  const workspaceId = await resolveWorkspaceId(user.id);
  return { user, workspaceId };
});

export const getWorkspaceContextWithRole = cache(async (): Promise<{
  user: Awaited<ReturnType<typeof requireAuthUser>>;
  workspaceId: string;
  role: MembershipRole | null;
}> => {
  const { user, workspaceId } = await getWorkspaceContext();
  const membership = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
  });
  return { user, workspaceId, role: membership?.role ?? null };
});

/**
 * Lista todos os workspaces aos quais o usuário pertence + identifica o ativo.
 * Útil pro `AppChrome` montar o WorkspaceSwitcher.
 */
export async function getWorkspacesForUser(): Promise<{
  current: WorkspaceOption;
  workspaces: WorkspaceOption[];
  viewer: {
    email: string;
    displayName: string;
    avatarUrl: string | null;
  };
} | null> {
  const user = await getAuthUserAndSync();
  if (!user) return null;
  const activeId = await resolveWorkspaceId(user.id);
  const [memberships, dbUser] = await Promise.all([
    prisma.membership.findMany({
      where: { userId: user.id },
      include: { workspace: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { email: true, name: true, avatarUrl: true },
    }),
  ]);
  if (memberships.length === 0) return null;
  const workspaces: WorkspaceOption[] = memberships.map((m) => ({
    id: m.workspaceId,
    name: m.workspace.name,
    role: m.role,
  }));
  const current = workspaces.find((w) => w.id === activeId) ?? workspaces[0]!;
  const email = dbUser?.email ?? user.email ?? "";
  const displayName =
    dbUser?.name?.trim() ||
    (user.email?.includes("@") ? user.email.split("@")[0] : null) ||
    "Conta";
  const viewer = {
    email,
    displayName,
    avatarUrl: dbUser?.avatarUrl ?? null,
  };
  return { current, workspaces, viewer };
}

/**
 * Valida que o usuário tem uma permissão específica no workspace ativo.
 * Lança erro com mensagem amigável caso contrário.
 */
export async function requirePermission(permission: PermissionKey): Promise<{
  user: Awaited<ReturnType<typeof requireAuthUser>>;
  workspaceId: string;
  role: MembershipRole;
}> {
  const ctx = await getWorkspaceContextWithRole();
  if (!ctx.role) {
    throw new Error("Sem associação ativa neste workspace.");
  }
  if (!can(ctx.role, permission)) {
    throw new Error(`Permissão insuficiente: ${permission}`);
  }
  return { user: ctx.user, workspaceId: ctx.workspaceId, role: ctx.role };
}

/**
 * F15 — Gate de páginas admin/observabilidade: mesmo critério de
 * `observabilityView` (hoje: OWNER), respondendo com 404 para não vazar
 * existência da rota.
 */
export async function requireObservabilityViewPage(): Promise<{
  user: Awaited<ReturnType<typeof requireAuthUser>>;
  workspaceId: string;
  role: MembershipRole;
}> {
  try {
    return await requirePermission("observabilityView");
  } catch {
    notFound();
  }
}

/**
 * Valida que o usuário tem pelo menos uma das roles informadas no workspace ativo.
 * Útil quando a regra é puramente baseada em role e não em permissão nomeada.
 */
export async function requireRole(allowed: MembershipRole[]): Promise<{
  user: Awaited<ReturnType<typeof requireAuthUser>>;
  workspaceId: string;
  role: MembershipRole;
}> {
  const ctx = await getWorkspaceContextWithRole();
  if (!ctx.role) {
    throw new Error("Sem associação ativa neste workspace.");
  }
  if (!allowed.includes(ctx.role)) {
    throw new Error(
      `Permissão insuficiente. Requer: ${allowed.join(", ")} (atual: ${ctx.role})`,
    );
  }
  return { user: ctx.user, workspaceId: ctx.workspaceId, role: ctx.role };
}
