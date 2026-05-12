/**
 * Repara `Membership.userId` vazio (dados inválidos), comum em seeds antigos.
 * Atribui o primeiro `User` com id válido que ainda não tenha membership nesse workspace.
 *
 *   npx tsx --env-file=.env scripts/repair-membership-empty-userid.ts
 */
import "../src/lib/env-normalize";
import { prisma } from "../src/lib/prisma";

async function pickUserForWorkspace(workspaceId: string): Promise<string | null> {
  const users = await prisma.user.findMany({
    where: { NOT: { id: "" } },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  for (const u of users) {
    const clash = await prisma.membership.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: u.id } },
    });
    if (!clash) return u.id;
  }
  return null;
}

async function main() {
  const broken = await prisma.membership.findMany({
    where: { userId: "" },
    select: { id: true, workspaceId: true },
  });
  if (broken.length === 0) {
    console.log("Nenhuma membership com userId vazio.");
    return;
  }

  for (const row of broken) {
    const userId = await pickUserForWorkspace(row.workspaceId);
    if (!userId) {
      console.warn(`[skip] workspace ${row.workspaceId}: nenhum utilizador livre.`);
      continue;
    }
    await prisma.membership.update({
      where: { id: row.id },
      data: { userId },
    });
    console.log(`[ok] membership ${row.id} → userId ${userId}`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (e) => {
    console.error(e instanceof Error ? e.message : e);
    await prisma.$disconnect().catch(() => {});
    process.exit(1);
  });
