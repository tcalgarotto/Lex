import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomBytes } from "node:crypto";
import { InvitationStatus, MembershipRole, WorkspaceLicense } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  acceptInvitation,
  createOrRefreshInvitation,
  generateInvitationToken,
  revokeInvitation,
} from "@/lib/auth/invitations";
import { WorkspaceSeatLimitReachedError } from "@/lib/auth/workspace-seats";

/**
 * Integration: exercita o ciclo de convites contra Postgres real.
 * Cria um workspace efêmero e limpa tudo no final.
 */
describe("invitations integration", () => {
  const suffix = randomBytes(4).toString("hex");
  const ownerEmail = `it-owner-${suffix}@example.com`;
  const inviteeEmail = `it-invitee-${suffix}@example.com`;

  let workspaceId = "";
  let ownerId: string;
  let inviteeId: string;
  let strangerId: string;

  beforeAll(async () => {
    const ws = await prisma.workspace.create({
      data: {
        name: `IT ${suffix}`,
        slug: `it-${suffix}`,
        onboardingCompleted: true,
      },
    });
    workspaceId = ws.id;
    const owner = await prisma.user.create({
      data: { email: ownerEmail, name: "IT Owner" },
    });
    ownerId = owner.id;
    await prisma.membership.create({
      data: { workspaceId, userId: owner.id, role: MembershipRole.OWNER },
    });
    const invitee = await prisma.user.create({
      data: { email: inviteeEmail, name: "IT Invitee" },
    });
    inviteeId = invitee.id;
    const stranger = await prisma.user.create({
      data: { email: `it-stranger-${suffix}@example.com`, name: "IT Stranger" },
    });
    strangerId = stranger.id;
  });

  afterAll(async () => {
    if (!workspaceId) return;
    await prisma.activity.deleteMany({ where: { workspaceId } });
    await prisma.invitation.deleteMany({ where: { workspaceId } });
    await prisma.membership.deleteMany({ where: { workspaceId } });
    await prisma.workspace.delete({ where: { id: workspaceId } });
    await prisma.user.deleteMany({
      where: { id: { in: [ownerId, inviteeId, strangerId] } },
    });
    await prisma.$disconnect();
  });

  it("generateInvitationToken devolve token URL-safe ≥32 chars", () => {
    const t = generateInvitationToken();
    expect(t.length).toBeGreaterThanOrEqual(32);
    expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("createOrRefreshInvitation cria PENDING quando não existe", async () => {
    const inv = await createOrRefreshInvitation({
      workspaceId,
      email: inviteeEmail,
      role: MembershipRole.LAWYER,
      invitedById: ownerId,
    });
    expect(inv.isNew).toBe(true);
    expect(inv.token.length).toBeGreaterThanOrEqual(32);
  });

  it("createOrRefreshInvitation atualiza convite existente (mesmo id, novo token, role atualizada)", async () => {
    const first = await createOrRefreshInvitation({
      workspaceId,
      email: inviteeEmail,
      role: MembershipRole.ASSISTANT,
      invitedById: ownerId,
    });
    expect(first.isNew).toBe(false);
    const row = await prisma.invitation.findUnique({ where: { id: first.id } });
    expect(row?.role).toBe(MembershipRole.ASSISTANT);
    expect(row?.token).toBe(first.token);
  });

  it("acceptInvitation rejeita quando email não bate", async () => {
    const row = await prisma.invitation.findFirst({
      where: { workspaceId, email: inviteeEmail, status: InvitationStatus.PENDING },
    });
    expect(row).toBeTruthy();
    await expect(
      acceptInvitation({
        token: row!.token,
        userId: strangerId,
        userEmail: `it-stranger-${suffix}@example.com`,
      }),
    ).rejects.toThrow(/emitido/i);
  });

  it("acceptInvitation cria membership e marca ACCEPTED", async () => {
    const row = await prisma.invitation.findFirst({
      where: { workspaceId, email: inviteeEmail, status: InvitationStatus.PENDING },
    });
    const result = await acceptInvitation({
      token: row!.token,
      userId: inviteeId,
      userEmail: inviteeEmail,
    });
    expect(result.workspaceId).toBe(workspaceId);
    expect(result.role).toBe(MembershipRole.ASSISTANT);

    const m = await prisma.membership.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: inviteeId } },
    });
    expect(m?.role).toBe(MembershipRole.ASSISTANT);
    const after = await prisma.invitation.findUnique({ where: { id: row!.id } });
    expect(after?.status).toBe(InvitationStatus.ACCEPTED);
  });

  it("acceptInvitation é idempotente (re-aceitar não erra)", async () => {
    const row = await prisma.invitation.findFirst({
      where: { workspaceId, email: inviteeEmail, status: InvitationStatus.ACCEPTED },
    });
    const result = await acceptInvitation({
      token: row!.token,
      userId: inviteeId,
      userEmail: inviteeEmail,
    });
    expect(result.role).toBe(MembershipRole.ASSISTANT);
  });

  it("revokeInvitation muda PENDING para REVOKED", async () => {
    const inv = await createOrRefreshInvitation({
      workspaceId,
      email: `revoke-${suffix}@example.com`,
      role: MembershipRole.CLIENT,
      invitedById: ownerId,
    });
    await revokeInvitation({ workspaceId, invitationId: inv.id });
    const after = await prisma.invitation.findUnique({ where: { id: inv.id } });
    expect(after?.status).toBe(InvitationStatus.REVOKED);
    expect(after?.revokedAt).toBeTruthy();
  });

  it("acceptInvitation rejeita convite expirado e marca como EXPIRED", async () => {
    const inv = await prisma.invitation.create({
      data: {
        workspaceId,
        email: `expired-${suffix}@example.com`,
        role: MembershipRole.LAWYER,
        token: generateInvitationToken(),
        invitedById: ownerId,
        expiresAt: new Date(Date.now() - 60_000),
        status: InvitationStatus.PENDING,
      },
    });
    await expect(
      acceptInvitation({
        token: inv.token,
        userId: inviteeId,
        userEmail: `expired-${suffix}@example.com`,
      }),
    ).rejects.toThrow(/expirou/i);
    const after = await prisma.invitation.findUnique({ where: { id: inv.id } });
    expect(after?.status).toBe(InvitationStatus.EXPIRED);
  });
});

describe("invitations — limite de lugares (SOLO)", () => {
  const suffix = randomBytes(4).toString("hex");
  let soloWorkspaceId = "";
  let soloOwnerId = "";

  beforeAll(async () => {
    const ws = await prisma.workspace.create({
      data: {
        name: `IT solo seats ${suffix}`,
        slug: `it-solo-seats-${suffix}`,
        license: WorkspaceLicense.SOLO,
        onboardingCompleted: true,
      },
    });
    soloWorkspaceId = ws.id;
    const owner = await prisma.user.create({
      data: { email: `it-solo-owner-${suffix}@example.com`, name: "Solo Owner" },
    });
    soloOwnerId = owner.id;
    await prisma.membership.create({
      data: { workspaceId: soloWorkspaceId, userId: owner.id, role: MembershipRole.OWNER },
    });
  });

  afterAll(async () => {
    if (!soloWorkspaceId) return;
    await prisma.invitation.deleteMany({ where: { workspaceId: soloWorkspaceId } });
    await prisma.membership.deleteMany({ where: { workspaceId: soloWorkspaceId } });
    await prisma.workspace.delete({ where: { id: soloWorkspaceId } });
    await prisma.user.deleteMany({ where: { email: `it-solo-owner-${suffix}@example.com` } });
  });

  it("createOrRefreshInvitation bloqueia novo convite quando plano SOLO está cheio", async () => {
    await expect(
      createOrRefreshInvitation({
        workspaceId: soloWorkspaceId,
        email: `extra-${suffix}@example.com`,
        role: MembershipRole.LAWYER,
        invitedById: soloOwnerId,
      }),
    ).rejects.toThrow(WorkspaceSeatLimitReachedError);
  });

  it("DUO com 1 membro permite um convite novo", async () => {
    const ws = await prisma.workspace.create({
      data: {
        name: `IT duo ${suffix}`,
        slug: `it-duo-${suffix}`,
        license: WorkspaceLicense.DUO,
      },
    });
    const owner = await prisma.user.create({
      data: { email: `it-duo-owner-${suffix}@example.com`, name: "Duo Owner" },
    });
    await prisma.membership.create({
      data: { workspaceId: ws.id, userId: owner.id, role: MembershipRole.OWNER },
    });
    const inv = await createOrRefreshInvitation({
      workspaceId: ws.id,
      email: `it-duo-a-${suffix}@example.com`,
      role: MembershipRole.LAWYER,
      invitedById: owner.id,
    });
    expect(inv.isNew).toBe(true);
    await expect(
      createOrRefreshInvitation({
        workspaceId: ws.id,
        email: `it-duo-b-${suffix}@example.com`,
        role: MembershipRole.LAWYER,
        invitedById: owner.id,
      }),
    ).rejects.toThrow(WorkspaceSeatLimitReachedError);
    await prisma.invitation.deleteMany({ where: { workspaceId: ws.id } });
    await prisma.membership.deleteMany({ where: { workspaceId: ws.id } });
    await prisma.workspace.delete({ where: { id: ws.id } });
    await prisma.user.delete({ where: { id: owner.id } });
  });
});
