/**
 * Ativa JustOS no workspace (onboardingJson.justos.enabled).
 * Uso: npx tsx scripts/enable-justos-workspace.ts [workspaceId] [--pro]
 */
import { PrismaClient } from "@prisma/client";
import { mergeJustosWorkspaceConfig } from "../src/lib/justos/workspace-config";

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--pro");
  const pro = process.argv.includes("--pro");
  let workspaceId = args[0];

  if (!workspaceId) {
    const first = await prisma.workspace.findFirst({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    });
    if (!first) {
      console.error("Nenhum workspace encontrado.");
      process.exit(1);
    }
    workspaceId = first.id;
    console.log(`Workspace: ${first.name ?? workspaceId}`);
  }

  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { onboardingJson: true },
  });
  if (!ws) {
    console.error("Workspace não encontrado:", workspaceId);
    process.exit(1);
  }

  const onboardingJson = mergeJustosWorkspaceConfig(ws.onboardingJson, {
    enabled: true,
    proEnabled: pro,
  });

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { onboardingJson: onboardingJson as object },
  });

  console.log(`JustOS ativado em ${workspaceId}${pro ? " (Pro)" : ""}.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
