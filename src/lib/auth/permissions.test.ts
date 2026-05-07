import { describe, expect, it } from "vitest";
import { MembershipRole } from "@prisma/client";
import {
  ROLE_LEVEL,
  ROLE_LABEL,
  PERMISSIONS,
  can,
  hasAtLeast,
  hasAnyRole,
} from "./permissions";

const ALL_ROLES: MembershipRole[] = [
  MembershipRole.OWNER,
  MembershipRole.ADMIN,
  MembershipRole.LAWYER,
  MembershipRole.ASSISTANT,
  MembershipRole.CLIENT,
];

describe("permissions/hierarchy", () => {
  it("ROLE_LEVEL é estritamente decrescente OWNER>ADMIN>LAWYER>ASSISTANT>CLIENT", () => {
    expect(ROLE_LEVEL.OWNER).toBeGreaterThan(ROLE_LEVEL.ADMIN);
    expect(ROLE_LEVEL.ADMIN).toBeGreaterThan(ROLE_LEVEL.LAWYER);
    expect(ROLE_LEVEL.LAWYER).toBeGreaterThan(ROLE_LEVEL.ASSISTANT);
    expect(ROLE_LEVEL.ASSISTANT).toBeGreaterThan(ROLE_LEVEL.CLIENT);
  });

  it("toda role tem label PT-BR", () => {
    for (const r of ALL_ROLES) {
      expect(ROLE_LABEL[r]).toBeTruthy();
      expect(typeof ROLE_LABEL[r]).toBe("string");
    }
  });

  it("hasAtLeast é reflexiva e transitiva", () => {
    for (const r of ALL_ROLES) {
      expect(hasAtLeast(r, r)).toBe(true);
    }
    expect(hasAtLeast(MembershipRole.OWNER, MembershipRole.CLIENT)).toBe(true);
    expect(hasAtLeast(MembershipRole.ADMIN, MembershipRole.LAWYER)).toBe(true);
    expect(hasAtLeast(MembershipRole.ASSISTANT, MembershipRole.LAWYER)).toBe(false);
    expect(hasAtLeast(MembershipRole.CLIENT, MembershipRole.LAWYER)).toBe(false);
  });

  it("hasAnyRole funciona com lista", () => {
    expect(hasAnyRole(MembershipRole.LAWYER, [MembershipRole.LAWYER, MembershipRole.ADMIN])).toBe(
      true,
    );
    expect(hasAnyRole(MembershipRole.CLIENT, [MembershipRole.LAWYER, MembershipRole.ADMIN])).toBe(
      false,
    );
  });
});

describe("permissions/PERMISSIONS map", () => {
  it("OWNER tem TODAS as permissões", () => {
    for (const key of Object.keys(PERMISSIONS) as Array<keyof typeof PERMISSIONS>) {
      expect(PERMISSIONS[key](MembershipRole.OWNER)).toBe(true);
    }
  });

  it("CLIENT NÃO tem permissões de gestão/edição", () => {
    const restricted: Array<keyof typeof PERMISSIONS> = [
      "workspaceManage",
      "workspaceDelete",
      "membersInvite",
      "membersRemove",
      "membersChangeRole",
      "processesEdit",
      "processesDelete",
      "documentsDelete",
      "piecesCreate",
      "piecesEdit",
      "billingManage",
      "observabilityView",
    ];
    for (const k of restricted) {
      expect(PERMISSIONS[k](MembershipRole.CLIENT)).toBe(false);
    }
  });

  it("apenas OWNER deleta workspace e gerencia billing", () => {
    expect(can(MembershipRole.OWNER, "workspaceDelete")).toBe(true);
    expect(can(MembershipRole.ADMIN, "workspaceDelete")).toBe(false);
    expect(can(MembershipRole.OWNER, "billingManage")).toBe(true);
    expect(can(MembershipRole.ADMIN, "billingManage")).toBe(false);
  });

  it("ASSISTANT pode subir documento mas NÃO pode deletar", () => {
    expect(can(MembershipRole.ASSISTANT, "documentsUpload")).toBe(true);
    expect(can(MembershipRole.ASSISTANT, "documentsDelete")).toBe(false);
  });

  it("LAWYER pode editar peças, ASSISTANT não", () => {
    expect(can(MembershipRole.LAWYER, "piecesEdit")).toBe(true);
    expect(can(MembershipRole.ASSISTANT, "piecesEdit")).toBe(false);
  });

  it("ADMIN convida e remove membros, LAWYER não", () => {
    expect(can(MembershipRole.ADMIN, "membersInvite")).toBe(true);
    expect(can(MembershipRole.LAWYER, "membersInvite")).toBe(false);
    expect(can(MembershipRole.ADMIN, "membersRemove")).toBe(true);
    expect(can(MembershipRole.LAWYER, "membersRemove")).toBe(false);
  });

  it("can() devolve false para role nula (anônimo)", () => {
    expect(can(null, "membersInvite")).toBe(false);
    expect(can(null, "workspaceDelete")).toBe(false);
  });
});
