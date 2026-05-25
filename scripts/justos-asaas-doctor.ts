#!/usr/bin/env npx tsx
import { PrismaClient } from "@prisma/client";
import { readJustosWorkspaceConfig, isJustosProActive } from "../src/lib/justos/workspace-config";

const prisma = new PrismaClient();

async function main() {
  console.log("=== JustOS Asaas Doctor ===\n");
  console.log("ASAAS_ENV:", process.env["ASAAS_ENV"] ?? "(unset)");
  console.log("API key:", process.env["ASAAS_API_KEY"] ? "set" : "MISSING");

  const events = await prisma.justosBillingEvent.count();
  console.log("Billing events (idempotent):", events);

  const workspaces = await prisma.workspace.findMany({ take: 10 });
  for (const ws of workspaces) {
    const cfg = readJustosWorkspaceConfig(ws.onboardingJson);
    if (!cfg.asaasSubscriptionId && !isJustosProActive(cfg)) continue;
    console.log(
      ws.id.slice(0, 12),
      "pro=",
      isJustosProActive(cfg),
      "sub=",
      cfg.asaasSubscriptionId ?? "-",
      "until=",
      cfg.proAccessUntil ?? "-",
    );
  }
  await prisma.$disconnect();
}

main();
