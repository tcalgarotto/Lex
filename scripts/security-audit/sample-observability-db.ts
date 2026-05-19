/**
 * Amostragem de ObservabilityLog no Postgres (fixtures red-team).
 * Não imprime payload integral — só padrões detectados.
 *
 *   npm run security:sample-observability-logs
 */

import { prisma } from "@/lib/prisma";

const FORBIDDEN_PATTERNS: Array<{ id: string; re: RegExp; severity: string }> = [
  { id: "service_role", re: /service[_-]?role|SUPABASE_SERVICE_ROLE/i, severity: "P0" },
  { id: "api_key", re: /DEEPSEEK_API_KEY|sk-[a-z0-9]{12,}/i, severity: "P0" },
  { id: "jwt", re: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./, severity: "P0" },
  { id: "segredo_bravo", re: /segredo ultra confidencial Bravo/i, severity: "P0" },
  { id: "extractedText", re: /"extractedText"\s*:\s*"/, severity: "P1" },
  { id: "system_base", re: /SYSTEM_BASE|systemPrompt/i, severity: "P1" },
  { id: "prompt_integral", re: /"prompt"\s*:\s*"/, severity: "P1" },
];

const ALLOW_KEYS = new Set([
  "queryLen",
  "traceId",
  "workspaceId",
  "userId",
  "engine",
  "confidence",
  "candidates",
  "groundingScore",
  "model",
  "provider",
  "promptTokens",
  "completionTokens",
  "latencyMs",
]);

async function main() {
  const rows = await prisma.observabilityLog.findMany({
    where: { workspaceId: { in: ["rt_workspace_a", "rt_workspace_b"] } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      workspaceId: true,
      kind: true,
      name: true,
      payloadJson: true,
      errorMessage: true,
      createdAt: true,
    },
  });

  console.log(`[obs-sample] Registros amostrados: ${rows.length} (workspaces red-team)`);

  const hits: Array<{ severity: string; pattern: string; id: string; kind: string }> = [];

  for (const row of rows) {
    const blob = JSON.stringify({
      payloadJson: row.payloadJson,
      errorMessage: row.errorMessage,
    });
    for (const p of FORBIDDEN_PATTERNS) {
      if (p.re.test(blob)) {
        hits.push({
          severity: p.severity,
          pattern: p.id,
          id: row.id.slice(0, 8) + "…",
          kind: row.kind,
        });
      }
    }
    if (row.payloadJson && typeof row.payloadJson === "object" && !Array.isArray(row.payloadJson)) {
      const keys = Object.keys(row.payloadJson as Record<string, unknown>);
      const unknown = keys.filter((k) => !ALLOW_KEYS.has(k) && k !== "action" && k !== "entity");
      if (unknown.length > 8) {
        hits.push({
          severity: "P3",
          pattern: "payload_keys_excess",
          id: row.id.slice(0, 8) + "…",
          kind: row.kind,
        });
      }
    }
  }

  if (hits.length === 0) {
    console.log("[obs-sample] PASSOU — nenhum padrão proibido na amostra DB.");
  } else {
    const p0 = hits.filter((h) => h.severity === "P0").length;
    const p1 = hits.filter((h) => h.severity === "P1").length;
    console.log(`[obs-sample] Achados: P0=${p0} P1=${p1} total=${hits.length}`);
    for (const h of hits.slice(0, 15)) {
      console.log(`[obs-sample] ${h.severity} pattern=${h.pattern} kind=${h.kind} id=${h.id}`);
    }
    if (hits.length > 15) console.log(`[obs-sample] … +${hits.length - 15} omitidos`);
  }

  console.log("[obs-sample] PENDENTE: painéis Vercel/Sentry/Langfuse (revisão manual).");
  console.log("[obs-sample] Não declarar sistema seguro.");

  const p0 = hits.filter((h) => h.severity === "P0").length;
  const p1 = hits.filter((h) => h.severity === "P1").length;
  process.exit(p0 + p1 > 0 ? 1 : 0);
}

main()
  .catch((e) => {
    console.error("[obs-sample] ERRO:", e instanceof Error ? e.message : String(e));
    process.exit(2);
  })
  .finally(() => prisma.$disconnect());
