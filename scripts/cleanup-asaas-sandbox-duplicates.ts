/**
 * npm run justos:asaas:cleanup-sandbox-duplicates -- --dry-run
 * npm run justos:asaas:cleanup-sandbox-duplicates -- --workspace=<id> --execute
 */
import { prisma } from "../src/lib/prisma";
import { readJustosWorkspaceConfig } from "../src/lib/justos/workspace-config";
import {
  cancelDuplicateWorkspaceSubscriptions,
  listAsaasSubscriptionsForWorkspace,
} from "../src/lib/billing/asaas/subscription-reuse";

const args = process.argv.slice(2);
const dryRun = !args.includes("--execute");
const wsArg = args.find((a) => a.startsWith("--workspace="))?.split("=")[1];

async function main() {
  const workspaces = wsArg
    ? await prisma.workspace.findMany({ where: { id: wsArg } })
    : await prisma.workspace.findMany({ take: 50 });

  for (const ws of workspaces) {
    const cfg = readJustosWorkspaceConfig(ws.onboardingJson);
    const subs = await listAsaasSubscriptionsForWorkspace(ws.id);
    if (subs.length <= 1) continue;

    const keep = cfg.asaasSubscriptionId ?? subs[0]?.id;
    if (!keep) continue;

    console.log(ws.id, "subs:", subs.length, "keep:", keep, dryRun ? "(dry-run)" : "(execute)");
    const result = await cancelDuplicateWorkspaceSubscriptions({
      workspaceId: ws.id,
      keepSubscriptionId: keep,
      dryRun,
    });
    console.log("  cancelled:", result.cancelled);
    console.log("  skipped:", result.skipped);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
