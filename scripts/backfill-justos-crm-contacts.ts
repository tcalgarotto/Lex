/**
 * Backfill idempotente Client/Case → CrmContact.
 * Uso: npm run justos:crm:backfill
 *      WORKSPACE_ID=xxx npm run justos:crm:backfill
 */
import { PrismaClient } from "@prisma/client";
import { backfillCrmContactsFromClients } from "../src/lib/justos/crm/backfill";

const prisma = new PrismaClient();

async function main() {
  const workspaceId =
    process.env["WORKSPACE_ID"]?.trim() ??
    (
      await prisma.workspace.findFirst({
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true },
      })
    )?.id;

  if (!workspaceId) {
    console.error("Nenhum workspace encontrado.");
    process.exit(1);
  }

  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { name: true },
  });
  console.log("Workspace:", ws?.name ?? workspaceId);

  const report = await backfillCrmContactsFromClients(workspaceId);
  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
