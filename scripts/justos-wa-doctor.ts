#!/usr/bin/env npx tsx
/**
 * Diagnóstico WhatsApp JustOS — Command, OpenClaw, sessões.
 * npm run justos:wa:doctor
 */

import fs from "fs";
import path from "path";
import { readJustosCommandUrl, readJustosOpenClawMode } from "../src/lib/justos/env";

const COMMAND = (readJustosCommandUrl() ?? "http://127.0.0.1:3301").replace(/\/$/, "");
const APP = process.env["JUSTOS_API_BASE_URL"] ?? "http://127.0.0.1:3000";
const SESSIONS_ROOT = path.join(
  process.env["HOME"] ?? "/home/thales",
  "local-ai-control/services/justos-command/sessions",
);

async function ping(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return r.ok;
  } catch {
    return false;
  }
}

async function main() {
  console.log("=== JustOS WhatsApp Doctor ===\n");
  const mode = readJustosOpenClawMode();
  console.log("Modo OpenClaw:", mode);
  console.log("JUSTOS_CRM_ENABLE_WA_SEND:", process.env["JUSTOS_CRM_ENABLE_WA_SEND"] ?? "false");
  console.log("JUSTOS_USE_LEGACY_BRIDGE:", process.env["JUSTOS_USE_LEGACY_BRIDGE"] ?? "false");
  console.log("Command:", COMMAND, (await ping(`${COMMAND}/health`)) ? "OK" : "OFFLINE");
  console.log("App:", APP, (await ping(`${APP}/api/health`)) ? "OK" : "OFFLINE");

  if (mode === "dev-single") {
    console.log("\n⚠ RISCO: dev-single — um WhatsApp global (SOLD). Não use em staging multi-tenant.");
  }

  try {
    const w = await fetch(`${COMMAND}/workers`, { signal: AbortSignal.timeout(5000) });
    if (w.ok) {
      const data = (await w.json()) as { workers?: Array<Record<string, unknown>> };
      console.log("\nWorkers ativos:", data.workers?.length ?? 0);
      for (const row of data.workers ?? []) {
        console.log(" -", row["workspaceId"], row["sessionKey"], "port", row["port"], row["status"]);
      }
    }
  } catch {
    console.log("\nWorkers: indisponível (secret ou Command antigo)");
  }

  if (fs.existsSync(SESSIONS_ROOT)) {
    console.log("\nSessões em disco:");
    for (const ent of fs.readdirSync(SESSIONS_ROOT, { withFileTypes: true })) {
      if (!ent.isDirectory() || !ent.name.startsWith("ws_")) continue;
      const st = path.join(SESSIONS_ROOT, ent.name, "state.json");
      if (fs.existsSync(st)) {
        const s = JSON.parse(fs.readFileSync(st, "utf8")) as Record<string, unknown>;
        console.log(`  ${ent.name}: status=${s["status"]} port=${s["port"] ?? "-"}`);
      }
    }
  }

  console.log("\nPróximo: Desconectar → Conectar no /settings/integracoes/justos");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
