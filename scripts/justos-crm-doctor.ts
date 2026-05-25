#!/usr/bin/env npx tsx
import { PrismaClient } from "@prisma/client";
import { isJustosProActive, readJustosWorkspaceConfig } from "../src/lib/justos/workspace-config";

const prisma = new PrismaClient();

async function main() {
  console.log("=== JustOS CRM Doctor ===\n");
  const workspaces = await prisma.workspace.findMany({ take: 5, orderBy: { createdAt: "asc" } });
  for (const ws of workspaces) {
    const cfg = readJustosWorkspaceConfig(ws.onboardingJson);
    const pro = isJustosProActive(cfg);
    const [contacts, convs, unread, activities] = await Promise.all([
      prisma.crmContact.count({ where: { workspaceId: ws.id, deletedAt: null } }),
      prisma.crmConversation.count({ where: { workspaceId: ws.id } }),
      prisma.crmConversation.count({ where: { workspaceId: ws.id, unreadCount: { gt: 0 } } }),
      prisma.crmActivity.count({ where: { workspaceId: ws.id } }),
    ]);
    console.log(`${ws.name} (${ws.id.slice(0, 8)}…) Pro=${pro} contacts=${contacts} conv=${convs} unread=${unread} activities=${activities}`);
  }
  await prisma.$disconnect();
}

main();
