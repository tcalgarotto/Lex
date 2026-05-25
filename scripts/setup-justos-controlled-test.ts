/**
 * Prepara workspace + caso para teste controlado JustOS.
 * JUSTOS_TEST_LAWYER_WA=5547... npx tsx scripts/setup-justos-controlled-test.ts
 */
import { PrismaClient } from "@prisma/client";
import { mergeJustosWorkspaceConfig } from "../src/lib/justos/workspace-config";
import { saveCaseN8nSecretary } from "../src/lib/justos/n8n-secretary-store";
import { normalizeJustosPhone } from "../src/lib/justos/phone-normalize";

const prisma = new PrismaClient();
const lawyerRaw = process.env["JUSTOS_TEST_LAWYER_WA"]?.trim() ?? "";
const lawyer = normalizeJustosPhone(lawyerRaw);

async function main() {
  if (!lawyer) {
    console.error("Defina JUSTOS_TEST_LAWYER_WA");
    process.exit(1);
  }

  const ws = await prisma.workspace.findFirst({ orderBy: { createdAt: "asc" } });
  if (!ws) throw new Error("Sem workspace");

  const onboardingJson = mergeJustosWorkspaceConfig(ws.onboardingJson, {
    enabled: true,
    proEnabled: true,
    lawyerWhatsApp: [lawyer],
  });
  await prisma.workspace.update({
    where: { id: ws.id },
    data: { onboardingJson: onboardingJson as object },
  });

  const c = await prisma.case.findFirst({
    where: { workspaceId: ws.id, deletedAt: null },
    orderBy: { updatedAt: "desc" },
  });
  if (!c) throw new Error("Sem caso");

  await saveCaseN8nSecretary({
    workspaceId: ws.id,
    caseId: c.id,
    patch: {
      lawyerWhatsApp: [lawyer],
      preferences: { clientOptOut: true, lawyerOptOut: false },
    },
  });

  console.log(JSON.stringify({ workspaceId: ws.id, caseId: c.id, title: c.title, lawyerWa: lawyer }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
