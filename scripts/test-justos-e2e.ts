/**
 * Teste E2E JustOS: Lex emit → n8n webhook → (opcional) callback case-brain.
 * Uso: npx tsx scripts/test-justos-e2e.ts [--lex-callback]
 */
import { PrismaClient } from "@prisma/client";
import { readJustosWorkspaceConfig } from "../src/lib/justos/workspace-config";
import { emitLexJustosEventForCase } from "../src/lib/justos/emit-for-case";

const prisma = new PrismaClient();
const withLexCallback = process.argv.includes("--lex-callback");

async function main() {
  const ws = await prisma.workspace.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, onboardingJson: true },
  });
  if (!ws) {
    console.error("FAIL: nenhum workspace");
    process.exit(1);
  }

  const justos = readJustosWorkspaceConfig(ws.onboardingJson);
  console.log("workspace:", ws.name ?? ws.id);
  console.log("justos.enabled:", justos.enabled, "| pro:", justos.proEnabled);

  const c = await prisma.case.findFirst({
    where: { workspaceId: ws.id, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true },
  });
  if (!c) {
    console.error("FAIL: nenhum caso no workspace");
    process.exit(1);
  }
  console.log("case:", c.title, c.id);

  const webhookUrl = process.env["LEX_N8N_WEBHOOK_URL"]?.trim();
  const secret = process.env["LEX_N8N_WEBHOOK_SECRET"]?.trim();
  if (!webhookUrl || !secret) {
    console.error("FAIL: LEX_N8N_WEBHOOK_URL ou SECRET ausente (.env.local)");
    process.exit(1);
  }

  console.log("\n--- 1) Lex → n8n (draft.generated) ---");
  const emit = await emitLexJustosEventForCase({
    event: "lex.draft.generated",
    workspaceId: ws.id,
    caseId: c.id,
    meta: { e2e: true, draftVersion: 1 },
  });
  console.log("emit:", emit);
  if (!emit.sent) {
    console.error("FAIL: evento não enviado —", emit.skipped);
    process.exit(1);
  }

  console.log("\n--- 2) n8n webhook direto (sanity) ---");
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-lex-n8n-secret": secret,
    },
    body: JSON.stringify({
      event: "intake.saved",
      caseId: c.id,
      workspaceId: ws.id,
      title: c.title,
      secretary: {
        preferences: { clientOptOut: true, lawyerOptOut: true },
      },
      extras: { e2e: true },
    }),
  });
  const body = await res.text();
  console.log("webhook HTTP", res.status, body.slice(0, 200));
  if (!res.ok) {
    process.exit(1);
  }

  if (withLexCallback) {
    const token = process.env["LEX_N8N_SERVICE_TOKEN"]?.trim();
    if (!token) {
      console.error("FAIL: LEX_N8N_SERVICE_TOKEN ausente");
      process.exit(1);
    }
    console.log("\n--- 3) n8n → Lex GET case-brain ---");
    const lexBase = process.env["LEX_API_BASE_URL"] ?? "http://127.0.0.1:3000";
    const snapRes = await fetch(`${lexBase}/api/cases/${c.id}/case-brain`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    console.log("case-brain HTTP", snapRes.status);
    if (!snapRes.ok) {
      const err = await snapRes.text();
      console.error(err.slice(0, 300));
      process.exit(1);
    }
    const snap = (await snapRes.json()) as { facts?: unknown[] };
    console.log("snapshot facts:", Array.isArray(snap.facts) ? snap.facts.length : "?");
  }

  console.log("\nOK: fluxo base validado. Ver Executions: http://127.0.0.1:5678");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
