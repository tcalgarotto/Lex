#!/usr/bin/env npx tsx
/**
 * Testa connect + QR via Command (primeiro workspace no DB).
 * npm run justos:wa:connect-test
 */

import { PrismaClient } from "@prisma/client";
import { buildSessionKey } from "../src/lib/justos/whatsapp/session-service";
import { readJustosCommandUrl } from "../src/lib/justos/env";

const prisma = new PrismaClient();
const base = (readJustosCommandUrl() ?? "http://127.0.0.1:3301").replace(/\/$/, "");

async function main() {
  const ws = await prisma.workspace.findFirst({ orderBy: { createdAt: "asc" } });
  if (!ws) {
    console.error("Sem workspace");
    process.exit(1);
  }
  const sk = buildSessionKey(ws.id);
  console.log("Workspace:", ws.name, ws.id, sk);

  const conn = await fetch(`${base}/sessions/${ws.id}/connect`, {
    method: "POST",
    headers: { "x-justos-workspace-id": ws.id },
  });
  console.log("connect", conn.status, await conn.text());

  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 4000));
    const qr = await fetch(`${base}/sessions/${ws.id}/qr`, {
      headers: { "x-justos-workspace-id": ws.id },
    });
    const j = (await qr.json()) as { qrAvailable?: boolean; status?: string; error?: string };
    console.log(`poll ${i + 1}:`, j.status, "qr=", j.qrAvailable, j.error ?? "");
    if (j.qrAvailable) break;
  }
  await prisma.$disconnect();
}

main();
