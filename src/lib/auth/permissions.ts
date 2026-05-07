import { MembershipRole } from "@prisma/client";

/**
 * Hierarquia de roles (do mais privilegiado ao menos):
 *   OWNER > ADMIN > LAWYER > ASSISTANT > CLIENT
 *
 * Convenção: o nível numérico maior é mais privilegiado. Permite checagens
 * "tem pelo menos X" via comparação simples.
 */
export const ROLE_LEVEL: Record<MembershipRole, number> = {
  OWNER: 100,
  ADMIN: 80,
  LAWYER: 60,
  ASSISTANT: 40,
  CLIENT: 20,
};

export const ROLE_LABEL: Record<MembershipRole, string> = {
  OWNER: "Proprietário",
  ADMIN: "Administrador",
  LAWYER: "Advogado",
  ASSISTANT: "Assistente",
  CLIENT: "Cliente",
};

export function hasAtLeast(role: MembershipRole, min: MembershipRole): boolean {
  return ROLE_LEVEL[role] >= ROLE_LEVEL[min];
}

export function hasAnyRole(role: MembershipRole, allowed: MembershipRole[]): boolean {
  return allowed.includes(role);
}

/**
 * Permissões de alto nível, derivadas das roles. Centralizar evita espalhar
 * regras de autorização pelo app.
 */
export const PERMISSIONS = {
  // Workspace
  workspaceManage: (role: MembershipRole) => hasAtLeast(role, MembershipRole.ADMIN),
  workspaceDelete: (role: MembershipRole) => role === MembershipRole.OWNER,

  // Membros
  membersInvite: (role: MembershipRole) => hasAtLeast(role, MembershipRole.ADMIN),
  membersRemove: (role: MembershipRole) => hasAtLeast(role, MembershipRole.ADMIN),
  membersChangeRole: (role: MembershipRole) => hasAtLeast(role, MembershipRole.ADMIN),

  // Processos
  processesCreate: (role: MembershipRole) => hasAtLeast(role, MembershipRole.ASSISTANT),
  processesEdit: (role: MembershipRole) => hasAtLeast(role, MembershipRole.LAWYER),
  processesDelete: (role: MembershipRole) => hasAtLeast(role, MembershipRole.ADMIN),
  processesViewAll: (role: MembershipRole) => hasAtLeast(role, MembershipRole.ASSISTANT),

  // Documentos
  documentsUpload: (role: MembershipRole) => hasAtLeast(role, MembershipRole.ASSISTANT),
  documentsDelete: (role: MembershipRole) => hasAtLeast(role, MembershipRole.LAWYER),

  // Peças
  piecesCreate: (role: MembershipRole) => hasAtLeast(role, MembershipRole.LAWYER),
  piecesEdit: (role: MembershipRole) => hasAtLeast(role, MembershipRole.LAWYER),

  // Faturamento / configurações sensíveis
  billingManage: (role: MembershipRole) => role === MembershipRole.OWNER,
  observabilityView: (role: MembershipRole) => role === MembershipRole.OWNER,
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

export function can(role: MembershipRole | null, permission: PermissionKey): boolean {
  if (!role) return false;
  return PERMISSIONS[permission](role);
}
