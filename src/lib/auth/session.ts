import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveWorkspaceId } from "@/lib/auth/workspace";
import { prisma } from "@/lib/prisma";
import type { MembershipRole } from "@prisma/client";
import { can, type PermissionKey } from "@/lib/auth/permissions";
import type { WorkspaceOption } from "@/components/app/workspace-switcher";

export async function getAuthUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function requireAuthUser() {
  const user = await getAuthUser();
  if (!user) throw new Error("Não autenticado");
  return user;
}

export async function getWorkspaceContext() {
  const user = await requireAuthUser();
  const workspaceId = await resolveWorkspaceId(user.id);
  return { user, workspaceId };
}

export async function getWorkspaceContextWithRole(): Promise<{
  user: Awaited<ReturnType<typeof requireAuthUser>>;
  workspaceId: string;
  role: MembershipRole | null;
}> {
  const { user, workspaceId } = await getWorkspaceContext();
  const membership = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: user.id } },
  });
  return { user, workspaceId, role: membership?.role ?? null };
}

/**
 * Lista todos os workspaces aos quais o usuário pertence + identifica o ativo.
 * Útil pro AppShell montar o WorkspaceSwitcher.
 */
export async function getWorkspacesForUser(): Promise<{
  current: WorkspaceOption;
  workspaces: WorkspaceOption[];
} | null> {
  const user = await getAuthUser();
  if (!user) return null;
  const activeId = await resolveWorkspaceId(user.id);
  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    include: { workspace: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
  if (memberships.length === 0) return null;
  const workspaces: WorkspaceOption[] = memberships.map((m) => ({
    id: m.workspaceId,
    name: m.workspace.name,
    role: m.role,
  }));
  const current = workspaces.find((w) => w.id === activeId) ?? workspaces[0]!;
  return { current, workspaces };
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
