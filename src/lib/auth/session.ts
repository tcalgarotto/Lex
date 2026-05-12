import { cache } from "react";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ensureAuthUserForRead } from "@/lib/auth/sync-user";
import { resolveWorkspaceId } from "@/lib/auth/workspace";
import { getActiveWorkspaceMembership } from "@/lib/auth/workspace-membership";
import { devLogLexTiming } from "@/lib/dev/server-timing";
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
 * Sessão autenticada + existência de `User`/`Membership` no Prisma.
 * No hot path de leitura não executa `upsert` — só grava se faltar linha (primeiro acesso).
 * Para sync completo (login/callback), usar `syncAuthUserToDatabase` em `@/lib/auth/sync-user`.
 */
export const getAuthUserAndSync = cache(async () => {
  const isDev = process.env.NODE_ENV === "development";
  const t0 = performance.now();
  const user = await getAuthUser();
  if (isDev) devLogLexTiming("auth.getAuthUser", performance.now() - t0);
  if (!user) return null;
  const t1 = performance.now();
  await ensureAuthUserForRead(user);
  if (isDev) devLogLexTiming("auth.ensureAuthUserForRead", performance.now() - t1);
  return user;
});

export const requireAuthUser = cache(async () => {
  const user = await getAuthUserAndSync();
  if (!user) throw new Error("Não autenticado");
  return user;
});

export const getWorkspaceContext = cache(async () => {
  const isDev = process.env.NODE_ENV === "development";
  const user = await requireAuthUser();
  const tw = performance.now();
  const workspaceId = await resolveWorkspaceId(user.id);
  if (isDev) devLogLexTiming("workspaceCtx.resolveWorkspaceId", performance.now() - tw);
  return { user, workspaceId };
});

export const getWorkspaceContextWithRole = cache(async (): Promise<{
  user: Awaited<ReturnType<typeof requireAuthUser>>;
  workspaceId: string;
  role: MembershipRole | null;
}> => {
  const isDev = process.env.NODE_ENV === "development";
  const user = await requireAuthUser();
  const tw = performance.now();
  const m = await getActiveWorkspaceMembership(user.id);
  if (isDev) devLogLexTiming("workspacectx.activeMembership", performance.now() - tw);
  return { user, workspaceId: m.workspaceId, role: m.role };
});

/**
 * Lista todos os workspaces aos quais o usuário pertence + identifica o ativo.
 * Útil pro `AppChrome` montar o WorkspaceSwitcher.
 * Memoizado por request (várias chamadas no mesmo layout não repetem queries).
 */
export const getWorkspacesForUser = cache(async (): Promise<{
  current: WorkspaceOption;
  workspaces: WorkspaceOption[];
  viewer: {
    email: string;
    displayName: string;
    avatarUrl: string | null;
  };
} | null> => {
  const user = await getAuthUser();
  if (!user) return null;
  await ensureAuthUserForRead(user);
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
});

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
