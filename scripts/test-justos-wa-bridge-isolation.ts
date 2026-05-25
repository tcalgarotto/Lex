/**
 * Verifica isolamento de bridge/porta/sessionKey entre 2 workspaces.
 * Requer Command em process-per-workspace e (opcional) 2 workspaces no DB.
 *
 * npm run justos:wa:test-isolation
 */

import { PrismaClient } from "@prisma/client";
import { buildSessionKey } from "../src/lib/justos/whatsapp/session-service";
import { readJustosCommandUrl, readJustosOpenClawMode } from "../src/lib/justos/env";

const prisma = new PrismaClient();
const base = (readJustosCommandUrl() ?? "http://127.0.0.1:3301").replace(/\/$/, "");

function portForSessionKey(sessionKey: string): number {
  const n = parseInt(sessionKey.replace(/\D/g, "").slice(0, 6), 10) || 0;
  return 34000 + (n % 500);
}

async function commandPost(path: string, workspaceId: string, sessionKey: string) {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-justos-workspace-id": workspaceId,
      "x-justos-session-key": sessionKey,
    },
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

async function commandGet(path: string, workspaceId: string, sessionKey: string) {
  const res = await fetch(`${base}${path}`, {
    headers: {
      "x-justos-workspace-id": workspaceId,
      "x-justos-session-key": sessionKey,
    },
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

async function main() {
  const mode = readJustosOpenClawMode();
  if (mode !== "process-per-workspace") {
    console.error(`FAIL: JUSTOS_OPENCLAW_MODE=${mode} — defina process-per-workspace no .env.local`);
    process.exit(1);
  }

  const workspaces = await prisma.workspace.findMany({ take: 2, orderBy: { createdAt: "asc" } });
  if (workspaces.length < 2) {
    console.error("FAIL: precisa de 2 workspaces no banco");
    process.exit(1);
  }

  const a = workspaces[0]!;
  const b = workspaces[1]!;
  const skA = buildSessionKey(a.id);
  const skB = buildSessionKey(b.id);
  const portA = portForSessionKey(skA);
  const portB = portForSessionKey(skB);

  if (skA === skB) {
    console.error("FAIL: sessionKey igual");
    process.exit(1);
  }
  if (portA === portB) {
    console.warn("WARN: portas iguais (raro) —", portA);
  }

  console.log("Workspace A:", a.name, a.id, skA, portA);
  console.log("Workspace B:", b.name, b.id, skB, portB);

  try {
    await fetch(`${base}/health`);
  } catch {
    console.error("FAIL: Command offline — npm run justos:command");
    process.exit(1);
  }

  const connA = await commandPost(`/sessions/${a.id}/connect`, a.id, skA);
  const connB = await commandPost(`/sessions/${b.id}/connect`, b.id, skB);
  console.log("connect A:", connA.status, connA.body["status"], "port", connA.body["openclawPort"]);
  console.log("connect B:", connB.status, connB.body["status"], "port", connB.body["openclawPort"]);

  if (
    connA.body["openclawPort"] &&
    connB.body["openclawPort"] &&
    connA.body["openclawPort"] === connB.body["openclawPort"]
  ) {
    console.error("FAIL: mesma porta de bridge para A e B");
    process.exit(1);
  }

  const qrA = await commandGet(`/sessions/${a.id}/qr`, a.id, skA);
  const qrB = await commandGet(`/sessions/${b.id}/qr`, b.id, skB);
  const textA = String(qrA.body["qrText"] ?? "");
  const textB = String(qrB.body["qrText"] ?? "");

  const realQr = (t: string) => t.length > 80 && !t.includes("SIMULATOR");
  if (realQr(textA) && realQr(textB) && textA === textB) {
    console.error("FAIL: QR payload idêntico entre workspaces (possível vazamento)");
    process.exit(1);
  }

  if (textA.includes("SIMULATOR") || textB.includes("SIMULATOR")) {
    console.log("WARN: OpenClaw ainda em SIMULATOR — aguarde ~60s e clique Conectar de novo para QR real.");
  }

  console.log("PASS: sessionKeys e bridges distintos (portas", portA, "vs", portB, ").");
  console.log("Próximo passo: escanear QR em cada escritório (contas WhatsApp diferentes).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
