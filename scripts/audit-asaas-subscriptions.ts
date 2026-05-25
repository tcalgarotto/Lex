/**
 * npm run justos:asaas:audit-subscriptions
 */
import { prisma } from "../src/lib/prisma";
import { readJustosWorkspaceConfig } from "../src/lib/justos/workspace-config";
import {
  listAsaasSubscriptionsForWorkspace,
} from "../src/lib/billing/asaas/subscription-reuse";
import { listSubscriptionPayments } from "../src/lib/billing/asaas/justos-pro";

async function main() {
  const workspaces = await prisma.workspace.findMany({
    select: { id: true, name: true, onboardingJson: true },
    take: 100,
  });

  for (const ws of workspaces) {
    const cfg = readJustosWorkspaceConfig(ws.onboardingJson);
    if (!cfg.asaasSubscriptionId && !cfg.asaasCustomerId) continue;

    const remote = await listAsaasSubscriptionsForWorkspace(ws.id);
    console.log("\n---", ws.name, ws.id);
    console.log("  local sub:", cfg.asaasSubscriptionId);
    console.log("  remote subs:", remote.length);
    for (const s of remote) {
      const payments = await listSubscriptionPayments(s.id);
      console.log(
        `    ${s.id} ${s.status} ref=${s.externalReference} payments=${payments.length}`,
      );
      for (const p of payments) {
        console.log(`      pay ${p.id} ${p.status} R$${p.value}`);
      }
    }
    if (remote.length > 1) {
      console.log("  ⚠ múltiplas assinaturas → possível 2+ e-mails de cobrança");
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
