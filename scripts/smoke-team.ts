/**
 * Smoke server-side dos fluxos de invitations.
 * Não passa pelo Supabase Auth (que está em rate limit) — exercita as
 * funções de domínio diretamente contra o Postgres do projeto.
 *
 * Uso: tsx --env-file=.env scripts/smoke-team.ts
 */
import { randomBytes } from "node:crypto";
import { MembershipRole, InvitationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  createOrRefreshInvitation,
  acceptInvitation,
  revokeInvitation,
} from "@/lib/auth/invitations";
import { can, hasAtLeast } from "@/lib/auth/permissions";

async function main() {
  const suffix = randomBytes(4).toString("hex");
  const ownerEmail = `smoke-owner-${suffix}@example.com`;
  const inviteeEmail = `smoke-invitee-${suffix}@example.com`;

  console.log("🔧 Criando workspace de teste…");
  const workspace = await prisma.workspace.create({
    data: {
      name: `Smoke ${suffix}`,
      slug: `smoke-${suffix}`,
      onboardingCompleted: true,
    },
  });
  const owner = await prisma.user.create({
    data: { email: ownerEmail, name: "Smoke Owner" },
  });
  await prisma.membership.create({
    data: { workspaceId: workspace.id, userId: owner.id, role: MembershipRole.OWNER },
  });

  // Permission helpers
  console.log("🔐 Testando permission helpers…");
  if (!can(MembershipRole.OWNER, "membersInvite"))
    throw new Error("OWNER deveria ter membersInvite");
  if (can(MembershipRole.CLIENT, "membersInvite"))
    throw new Error("CLIENT NÃO deveria ter membersInvite");
  if (!hasAtLeast(MembershipRole.ADMIN, MembershipRole.LAWYER))
    throw new Error("ADMIN >= LAWYER");
  if (hasAtLeast(MembershipRole.ASSISTANT, MembershipRole.ADMIN))
    throw new Error("ASSISTANT < ADMIN");

  // 1) Criar convite
  console.log("✉️  Criando convite…");
  const inv = await createOrRefreshInvitation({
    workspaceId: workspace.id,
    email: inviteeEmail,
    role: MembershipRole.LAWYER,
    invitedById: owner.id,
  });
  if (!inv.isNew) throw new Error("Convite deveria ser novo");

  // 2) Recriar (deve só atualizar)
  console.log("🔁 Refrescando convite duplicado…");
  const inv2 = await createOrRefreshInvitation({
    workspaceId: workspace.id,
    email: inviteeEmail,
    role: MembershipRole.ASSISTANT,
    invitedById: owner.id,
  });
  if (inv2.isNew) throw new Error("Convite duplicado deveria atualizar, não criar novo");
  if (inv2.id !== inv.id) throw new Error("Refresh deveria reutilizar id");

  // 3) Aceitar com email errado → falha
  console.log("🛑 Tentando aceitar com email errado…");
  const fakeUser = await prisma.user.create({
    data: { email: `outro-${suffix}@example.com`, name: "Errado" },
  });
  let rejected = false;
  try {
    await acceptInvitation({
      token: inv2.token,
      userId: fakeUser.id,
      userEmail: fakeUser.email,
    });
  } catch (e) {
    if (e instanceof Error && /e-mail|emitido/i.test(e.message)) rejected = true;
  }
  if (!rejected) throw new Error("Deveria ter rejeitado email errado");

  // 4) Aceitar com email certo → cria membership
  console.log("✅ Aceitando convite corretamente…");
  const invitee = await prisma.user.create({
    data: { email: inviteeEmail, name: "Smoke Invitee" },
  });
  const accepted = await acceptInvitation({
    token: inv2.token,
    userId: invitee.id,
    userEmail: invitee.email,
  });
  if (accepted.workspaceId !== workspace.id)
    throw new Error("Workspace errado ao aceitar");
  if (accepted.role !== MembershipRole.ASSISTANT)
    throw new Error("Role errada ao aceitar");

  const m = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: invitee.id } },
  });
  if (!m) throw new Error("Membership não foi criada");
  if (m.role !== MembershipRole.ASSISTANT) throw new Error("Role errada na membership");

  const accInv = await prisma.invitation.findUnique({ where: { id: inv2.id } });
  if (accInv?.status !== InvitationStatus.ACCEPTED)
    throw new Error("Status do convite deveria ser ACCEPTED");

  // 5) Idempotência: aceitar de novo não dá erro
  console.log("🔁 Re-aceitar (idempotência)…");
  const accepted2 = await acceptInvitation({
    token: inv2.token,
    userId: invitee.id,
    userEmail: invitee.email,
  });
  if (accepted2.role !== MembershipRole.ASSISTANT)
    throw new Error("Idempotência quebrada");

  // 6) Revoke num convite separado
  console.log("🗑  Revogando outro convite…");
  const inv3 = await createOrRefreshInvitation({
    workspaceId: workspace.id,
    email: `outro-novo-${suffix}@example.com`,
    role: MembershipRole.CLIENT,
    invitedById: owner.id,
  });
  await revokeInvitation({ workspaceId: workspace.id, invitationId: inv3.id });
  const revoked = await prisma.invitation.findUnique({ where: { id: inv3.id } });
  if (revoked?.status !== InvitationStatus.REVOKED)
    throw new Error("Revoke não atualizou status");

  // 7) Cleanup
  console.log("🧹 Limpando…");
  await prisma.membership.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.invitation.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.activity.deleteMany({ where: { workspaceId: workspace.id } });
  await prisma.workspace.delete({ where: { id: workspace.id } });
  await prisma.user.delete({ where: { id: owner.id } });
  await prisma.user.delete({ where: { id: invitee.id } });
  await prisma.user.delete({ where: { id: fakeUser.id } });

  console.log("\n🎉 Smoke server-side passou — invitations + permissions OK.");
}

main()
  .catch((err) => {
    console.error("❌ Smoke falhou:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
