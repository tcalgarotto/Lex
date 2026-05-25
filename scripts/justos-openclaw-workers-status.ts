/**
 * Lista workers OpenClaw por workspace (modo process-per-workspace).
 * npm run justos:openclaw:status
 */

import { PrismaClient } from "@prisma/client";
import { buildSessionKey } from "../src/lib/justos/whatsapp/session-service";
import { readJustosCommandUrl, readJustosOpenClawMode } from "../src/lib/justos/env";

const prisma = new PrismaClient();
const base = (readJustosCommandUrl() ?? "http://127.0.0.1:3301").replace(/\/$/, "");

async function main() {
  console.log("JUSTOS_OPENCLAW_MODE =", readJustosOpenClawMode());
  console.log("Command URL =", base);

  try {
    const health = await fetch(`${base}/health`);
    console.log("health:", health.status, await health.json());
  } catch (e) {
    console.error("Command offline — rode: npm run justos:command");
    process.exit(1);
  }

  try {
    const res = await fetch(`${base}/workers`);
    const data = (await res.json()) as { workers?: Array<Record<string, unknown>> };
    console.log("\nWorkers ativos no Command:");
    for (const w of data.workers ?? []) {
      console.log(" ", JSON.stringify(w));
    }
  } catch {
    console.log("(endpoint /workers indisponível — reinicie o Command)");
  }

  const workspaces = await prisma.workspace.findMany({
    take: 10,
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

  console.log("\nWorkspaces no banco (sessionKey + porta estimada):");
  for (const ws of workspaces) {
    const sk = buildSessionKey(ws.id);
    const n = parseInt(sk.replace(/\D/g, "").slice(0, 6), 10) || 0;
    const port = 34000 + (n % 500);
    console.log(`  ${ws.name}`);
    console.log(`    workspaceId: ${ws.id}`);
    console.log(`    sessionKey:  ${sk}`);
    console.log(`    bridge:      http://127.0.0.1:${port}`);
  }

  console.log("\nTeste manual:");
  console.log("  1) Login escritório A → /settings/integracoes/justos → Conectar → QR número 1");
  console.log("  2) Login escritório B (outro user/workspace) → Conectar → QR número 2");
  console.log("  3) Envie teste em A e confirme que B não recebe pelo número errado");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
