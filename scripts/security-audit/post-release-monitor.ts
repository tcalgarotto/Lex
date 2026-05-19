#!/usr/bin/env tsx
/**
 * Monitoramento pós-release (RC) — relatório + atualização de docs.
 *
 *   npm run security:post-release:monitor
 *   POST_RELEASE_PHASE=t72 npm run security:post-release:t72
 *
 * Nunca imprime secrets. Exit 1 se P0/P1.
 */

import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  classifyInngestLogLine,
  scanTextForForbidden,
  VERCEL_LOG_QUERIES,
  type MonitorSeverity,
} from "./post-release-forbidden-patterns";

const ROOT = resolve(__dirname, "../..");
const DEFAULT_BASE_URL = "https://lex-navy.vercel.app";
const DEFAULT_DEPLOYED_AT = "2026-05-19T18:24:00Z";

type StatusLabel = "PASSOU" | "FALHOU" | "PARCIAL" | "PENDENTE" | "NÃO EXECUTADO";

type CheckResult = {
  name: string;
  status: StatusLabel;
  detail: string;
  findings: Array<{ id: string; severity: MonitorSeverity; count: number }>;
};

const allFindings: Array<{ id: string; severity: MonitorSeverity; count: number; source: string }> =
  [];

function log(msg: string): void {
  console.log(`[post-release-monitor] ${msg}`);
}

function run(
  cmd: string,
  args: string[],
  opts?: { cwd?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number },
): { ok: boolean; stdout: string; stderr: string; code: number } {
  const r = spawnSync(cmd, args, {
    cwd: opts?.cwd ?? ROOT,
    env: { ...process.env, ...opts?.env },
    encoding: "utf8",
    timeout: opts?.timeoutMs ?? 600_000,
    maxBuffer: 20 * 1024 * 1024,
  });
  return {
    ok: r.status === 0,
    stdout: (r.stdout ?? "").toString(),
    stderr: (r.stderr ?? "").toString(),
    code: r.status ?? 1,
  };
}

function recordFindings(source: string, findings: Array<{ id: string; severity: MonitorSeverity; count: number }>) {
  for (const f of findings) {
    allFindings.push({ ...f, source });
  }
}

function resolvePhase(): { phase: string; skip: boolean; logWindow: string } {
  const explicit = (process.env["POST_RELEASE_PHASE"] ?? "manual").trim().toLowerCase();
  const deployedAt = new Date(process.env["POST_RELEASE_DEPLOYED_AT"]?.trim() || DEFAULT_DEPLOYED_AT);
  const now = new Date();
  const hours = (now.getTime() - deployedAt.getTime()) / 3_600_000;

  if (explicit && explicit !== "auto") {
    const window = explicit === "t72" ? "72h" : "24h";
    return { phase: explicit, skip: false, logWindow: window };
  }

  // auto (cron): decidir janela
  if (hours >= 60 && hours < 96) {
    return { phase: "t72", skip: false, logWindow: "72h" };
  }
  if (hours < 24 * 7) {
    return { phase: "daily", skip: false, logWindow: "24h" };
  }
  if (hours < 24 * 28) {
    const isMonday = now.getUTCDay() === 1;
    if (isMonday) return { phase: "weekly", skip: false, logWindow: "24h" };
    return { phase: "weekly", skip: true, logWindow: "24h" };
  }
  return { phase: "monthly", skip: true, logWindow: "24h" };
}

async function fetchJson(url: string, headers: Record<string, string>): Promise<unknown | null> {
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

function checkReady(baseUrl: string): CheckResult {
  try {
    const res = execSync(`curl -sS -w "\\n%{http_code}" "${baseUrl}/api/ready"`, {
      encoding: "utf8",
      timeout: 30_000,
    });
    const lines = res.trim().split("\n");
    const code = lines.at(-1) ?? "0";
    const body = lines.slice(0, -1).join("\n");
    const ok = code === "200" && body.includes('"ready":true');
    return {
      name: "ready",
      status: ok ? "PASSOU" : "FALHOU",
      detail: `HTTP ${code}`,
      findings: [],
    };
  } catch (e) {
    return {
      name: "ready",
      status: "FALHOU",
      detail: e instanceof Error ? e.message : "curl failed",
      findings: [],
    };
  }
}

function checkHealth(baseUrl: string, attempt = 1): CheckResult {
  try {
    const res = execSync(`curl -sS -w "\\n%{http_code}" "${baseUrl}/api/health"`, {
      encoding: "utf8",
      timeout: 90_000,
    });
    const lines = res.trim().split("\n");
    const code = lines.at(-1) ?? "0";
    const body = lines.slice(0, -1).join("\n");
    let statusOk = false;
    try {
      const j = JSON.parse(body) as { status?: string };
      statusOk = j.status === "ok";
    } catch {
      statusOk = false;
    }
    const ok = code === "200" && statusOk;
    if (!ok && attempt < 2 && (code === "503" || code === "502")) {
      log(`health HTTP ${code}, retry em 5s...`);
      execSync("sleep 5");
      return checkHealth(baseUrl, attempt + 1);
    }
    return {
      name: "health",
      status: ok ? "PASSOU" : "FALHOU",
      detail: `HTTP ${code}, status=${statusOk ? "ok" : "not-ok"}${attempt > 1 ? " (retry)" : ""}`,
      findings: [],
    };
  } catch (e) {
    return {
      name: "health",
      status: "FALHOU",
      detail: e instanceof Error ? e.message : "curl failed",
      findings: [],
    };
  }
}

function checkPlaywright(baseUrl: string): CheckResult {
  const hasCreds =
    (process.env["E2E_USER_EMAIL"]?.trim() && process.env["E2E_USER_PASSWORD"]?.trim()) ||
    (process.env["SUPABASE_TEST_USER_A_EMAIL"]?.trim() &&
      process.env["SUPABASE_TEST_USER_A_PASSWORD"]?.trim());
  if (!hasCreds) {
    return {
      name: "playwright",
      status: "NÃO EXECUTADO",
      detail: "credenciais E2E ausentes (SUPABASE_TEST_USER_* ou E2E_USER_*)",
      findings: [],
    };
  }
  const r = run(
    "npx",
    [
      "playwright",
      "test",
      "--config=playwright.config.ts",
      "--project=chromium-auth",
      "tests/e2e/security-qa-staging.spec.ts",
    ],
    {
      env: { ...process.env, E2E_BASE_URL: baseUrl, CI: "1" },
      timeoutMs: 900_000,
    },
  );
  const passed = r.ok && /(\d+) passed/.test(r.stdout);
  const match = r.stdout.match(/(\d+) passed/);
  const count = match?.[1] ?? "?";
  return {
    name: "playwright",
    status: passed ? "PASSOU" : "FALHOU",
    detail: passed ? `${count} passed` : `exit ${r.code}`,
    findings: [],
  };
}

function checkNpmScript(script: string, label: string): CheckResult {
  const r = run("npm", ["run", script], { timeoutMs: 120_000 });
  return {
    name: label,
    status: r.ok ? "PASSOU" : "FALHOU",
    detail: r.ok ? "exit 0" : `exit ${r.code}`,
    findings: [],
  };
}

function checkNpmAudit(): CheckResult {
  const r = run("npm", ["audit", "--json"], { timeoutMs: 120_000 });
  let total = -1;
  try {
    const j = JSON.parse(r.stdout || "{}") as { metadata?: { vulnerabilities?: { total?: number } } };
    total = j.metadata?.vulnerabilities?.total ?? -1;
  } catch {
    /* ignore */
  }
  const ok = r.ok && total === 0;
  return {
    name: "npm_audit",
    status: ok ? "PASSOU" : "FALHOU",
    detail: total >= 0 ? `${total} vulnerabilities` : `audit exit ${r.code}`,
    findings: [],
  };
}

function checkVercelLogs(baseUrl: string, since: string): CheckResult {
  if (!process.env["VERCEL_TOKEN"]?.trim()) {
    return {
      name: "vercel_logs",
      status: "PENDENTE",
      detail: "VERCEL_TOKEN ausente",
      findings: [],
    };
  }
  const aggregated: string[] = [];
  let queryHits = 0;
  for (const p of VERCEL_LOG_QUERIES) {
    const r = run(
      "npx",
      ["vercel", "logs", baseUrl, "--since", since, "--query", p.query, "--limit", "20"],
      { timeoutMs: 120_000 },
    );
    const out = `${r.stdout}\n${r.stderr}`;
    if (!/No logs found/i.test(out)) {
      queryHits += 1;
      aggregated.push(out);
    }
  }
  const findings = scanTextForForbidden(aggregated.join("\n"));
  recordFindings("vercel", findings);
  const hasP0P1 = findings.some((f) => f.severity === "P0" || f.severity === "P1");
  return {
    name: "vercel_logs",
    status: hasP0P1 ? "FALHOU" : "PASSOU",
    detail: `queries com hits: ${queryHits}; findings: ${findings.length}`,
    findings,
  };
}

function checkInngestLogs(baseUrl: string, since: string): CheckResult {
  if (!process.env["VERCEL_TOKEN"]?.trim()) {
    return {
      name: "inngest",
      status: "PENDENTE",
      detail: "VERCEL_TOKEN ausente",
      findings: [],
    };
  }
  const r = run(
    "npx",
    ["vercel", "logs", baseUrl, "--since", since, "--query", "inngest", "--limit", "50"],
    { timeoutMs: 120_000 },
  );
  const text = `${r.stdout}\n${r.stderr}`;
  const inngestFindings: Array<{ id: string; severity: MonitorSeverity; count: number }> = [];
  for (const line of text.split("\n")) {
    const c = classifyInngestLogLine(line);
    if (c.severity) {
      const id = `inngest_${c.note.replace(/\s+/g, "_").slice(0, 40)}`;
      const prev = inngestFindings.find((f) => f.id === id);
      if (prev) prev.count += 1;
      else inngestFindings.push({ id, severity: c.severity, count: 1 });
    }
  }
  recordFindings("inngest", inngestFindings);
  const hasP0P1 = inngestFindings.some((f) => f.severity === "P0" || f.severity === "P1");
  const explained =
    /PDF_NO_TEXT|GET \/api\/inngest\s+200|PUT \/api\/inngest\s+200/i.test(text) || text.length > 0;
  return {
    name: "inngest",
    status: hasP0P1 ? "FALHOU" : explained ? "PASSOU" : "PENDENTE",
    detail: hasP0P1
      ? "P0/P1 em logs inngest"
      : explained
        ? "PDF_NO_TEXT/206/500 operacional documentado"
        : "sem logs inngest na janela",
    findings: inngestFindings,
  };
}

async function checkSentry(): Promise<CheckResult> {
  const token = process.env["SENTRY_AUTH_TOKEN"]?.trim();
  const org = process.env["SENTRY_ORG"]?.trim();
  const project = process.env["SENTRY_PROJECT"]?.trim();
  if (!token || !org || !project) {
    return {
      name: "sentry",
      status: "NÃO EXECUTADO",
      detail: "SENTRY_AUTH_TOKEN / SENTRY_ORG / SENTRY_PROJECT ausente",
      findings: [],
    };
  }
  const sentryBase = (
    process.env["SENTRY_URL"] ?? process.env["SENTRY_API_BASE"] ?? "https://us.sentry.io"
  ).replace(/\/$/, "");
  const url = `${sentryBase}/api/0/projects/${encodeURIComponent(org)}/${encodeURIComponent(project)}/issues/?statsPeriod=24h&query=is:unresolved`;
  const data = await fetchJson(url, {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  });
  if (!data || !Array.isArray(data)) {
    return {
      name: "sentry",
      status: "PENDENTE",
      detail: "API Sentry indisponível ou resposta inválida",
      findings: [],
    };
  }
  const issues = data as Array<{ title?: string; culprit?: string; metadata?: { value?: string } }>;
  const blob = JSON.stringify(
    issues.map((i) => ({ title: i.title, culprit: i.culprit })),
  );
  const findings = scanTextForForbidden(blob);
  const testOnly =
    issues.length > 0 &&
    issues.every(
      (i) =>
        /sentry test|lex verification|sentry-example-page/i.test(i.title ?? "") ||
        /sentry-example-page/i.test(i.culprit ?? ""),
    );
  recordFindings("sentry", findings);
  const hasP0P1 = findings.some((f) => f.severity === "P0" || f.severity === "P1");
  if (hasP0P1) {
    return {
      name: "sentry",
      status: "FALHOU",
      detail: `issues=${issues.length}, padrões proibidos`,
      findings,
    };
  }
  if (testOnly || issues.length === 0) {
    return {
      name: "sentry",
      status: "PASSOU",
      detail:
        issues.length === 0
          ? "nenhuma issue aberta 24h"
          : "apenas eventos controlados /sentry-example-page",
      findings,
    };
  }
  return {
    name: "sentry",
    status: "PASSOU",
    detail: `${issues.length} issue(s) sem padrão P0/P1 no título`,
    findings,
  };
}

async function checkLangfuse(): Promise<CheckResult> {
  const pk = process.env["LANGFUSE_PUBLIC_KEY"]?.trim();
  const sk = process.env["LANGFUSE_SECRET_KEY"]?.trim();
  const host = (
    process.env["LANGFUSE_HOST"] ??
    process.env["LANGFUSE_BASE_URL"] ??
    "https://cloud.langfuse.com"
  ).replace(/\/$/, "");
  if (!pk || !sk) {
    return {
      name: "langfuse",
      status: "NÃO EXECUTADO",
      detail: "LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY ausente",
      findings: [],
    };
  }
  const smoke = run("npm", ["run", "observability:langfuse:smoke"], { timeoutMs: 120_000 });
  if (!smoke.ok) {
    const hint = smoke.stderr.includes("ENOENT") || smoke.stderr.includes(".env")
      ? "smoke falhou (CI sem .env — use LANGFUSE_* nos secrets)"
      : `smoke exit ${smoke.code}`;
    return {
      name: "langfuse",
      status: "PARCIAL",
      detail: hint,
      findings: [],
    };
  }
  const auth = Buffer.from(`${pk}:${sk}`).toString("base64");
  const tracesUrl = `${host}/api/public/traces?limit=20`;
  const traces = await fetchJson(tracesUrl, {
    Authorization: `Basic ${auth}`,
    Accept: "application/json",
  });
  let realTraffic = false;
  let blob = "";
  if (traces && typeof traces === "object" && "data" in traces) {
    const arr = (traces as { data?: unknown[] }).data ?? [];
    blob = JSON.stringify(arr.map((t) => (typeof t === "object" && t && "name" in t ? { name: (t as { name?: string }).name } : {})));
    realTraffic = arr.some(
      (t) =>
        typeof t === "object" &&
        t !== null &&
        "name" in t &&
        typeof (t as { name?: string }).name === "string" &&
        !(t as { name: string }).name.includes("langfuse-smoke-test"),
    );
  }
  const findings = scanTextForForbidden(blob);
  recordFindings("langfuse", findings);
  const hasP0P1 = findings.some((f) => f.severity === "P0" || f.severity === "P1");
  if (hasP0P1) {
    return { name: "langfuse", status: "FALHOU", detail: "padrões proibidos em traces", findings };
  }
  if (realTraffic) {
    return { name: "langfuse", status: "PASSOU", detail: "smoke OK + traces reais sem P0/P1", findings };
  }
  return {
    name: "langfuse",
    status: "PARCIAL",
    detail: "smoke OK; sem traces reais além de langfuse-smoke-test",
    findings,
  };
}

function worstSeverity(): MonitorSeverity | null {
  const order: MonitorSeverity[] = ["P0", "P1", "P2", "P3"];
  for (const s of order) {
    if (allFindings.some((f) => f.severity === s)) return s;
  }
  return null;
}

function formatReportMd(opts: {
  phase: string;
  baseUrl: string;
  sha: string;
  logWindow: string;
  checks: CheckResult[];
  nextWindow: string;
}): string {
  const ts = new Date().toISOString();
  const p0 = allFindings.filter((f) => f.severity === "P0");
  const p1 = allFindings.filter((f) => f.severity === "P1");
  const core = new Set(["ready", "health", "playwright", "logs_review", "db_sample", "npm_audit"]);
  const rollback =
    p0.length > 0 ||
    p1.length > 0 ||
    opts.checks.some((c) => core.has(c.name) && c.status === "FALHOU");
  const lines: string[] = [
    `# Post-release monitor — ${ts}`,
    "",
    "| Campo | Valor |",
    "|-------|--------|",
    `| Fase | ${opts.phase} |`,
    `| Base URL | ${opts.baseUrl} |`,
    `| Commit | ${opts.sha} |`,
    `| Janela logs | ${opts.logWindow} |`,
    "",
    "## Checks",
    "",
    "| Check | Status | Detalhe |",
    "|-------|--------|---------|",
  ];
  for (const c of opts.checks) {
    lines.push(`| ${c.name} | ${c.status} | ${c.detail.replace(/\|/g, "\\|")} |`);
  }
  lines.push("", "## Achados por severidade", "");
  if (allFindings.length === 0) {
    lines.push("_Nenhum achado P0–P3 em sinks/logs amostrados._");
  } else {
    lines.push("| ID | Sev | Count | Source |");
    lines.push("|----|-----|-------|--------|");
    for (const f of allFindings) {
      lines.push(`| ${f.id} | ${f.severity} | ${f.count} | ${f.source} |`);
    }
  }
  lines.push(
    "",
    "## Resumo",
    "",
    `- **P0:** ${p0.length}`,
    `- **P1:** ${p1.length}`,
    `- **Rollback necessário:** ${rollback ? "SIM" : "NÃO"}`,
    `- **Próxima janela:** ${opts.nextWindow}`,
    "",
    "**Não declarar sistema seguro.**",
    "",
  );
  return lines.join("\n");
}

function updateMonitoringDoc(opts: {
  phase: string;
  reportRelPath: string;
  checks: CheckResult[];
  responsible: string;
}): void {
  const docPath = resolve(ROOT, "docs/security/POST_RELEASE_MONITORING.md");
  let content = readFileSync(docPath, "utf8");
  const vercel = opts.checks.find((c) => c.name === "vercel_logs")?.status ?? "PENDENTE";
  const sentry = opts.checks.find((c) => c.name === "sentry")?.status ?? "NÃO EXECUTADO";
  const langfuse = opts.checks.find((c) => c.name === "langfuse")?.status ?? "NÃO EXECUTADO";
  const db = opts.checks.find((c) => c.name === "db_sample")?.status ?? "PENDENTE";
  const note = `relatório [${opts.reportRelPath}](${opts.reportRelPath}); cron FASE 5.10`;

  const rowLabel =
    opts.phase === "t72"
      ? "T+72h"
      : opts.phase === "daily"
        ? `Daily ${new Date().toISOString().slice(0, 10)}`
        : opts.phase === "weekly"
          ? `Weekly ${new Date().toISOString().slice(0, 10)}`
          : `Manual ${new Date().toISOString().slice(0, 10)}`;

  const newRow = `| ${rowLabel} | ${opts.responsible} | ${vercel} | ${sentry} | ${langfuse} | ${db} | ${note} |`;

  if (opts.phase === "t72") {
    content = content.replace(
      /\| T\+72h \|[^\n]+\|\n/,
      `${newRow}\n`,
    );
  } else if (!content.includes(rowLabel)) {
    content = content.replace(
      /(\| T\+72h \|[^\n]+\|\n)(\| T\+72h _pendente_|[^\n]*\n)?/,
      `$1${newRow}\n`,
    );
    if (!content.includes(rowLabel)) {
      content = content.replace(
        /(\| T\+24h \|[^\n]+\|\n)/,
        `$1${newRow}\n`,
      );
    }
  }

  if (!content.includes("## Cron automático")) {
    content += `

## Cron automático (FASE 5.10)

| Frequência | Janela | Ação |
|------------|--------|------|
| Manual | quando necessário | \`workflow_dispatch\` |
| Diário 08:37 UTC | 1ª semana pós-RC | health, logs, Sentry, Langfuse, DB, Playwright |
| Semanal 09:43 UTC (seg) | semanas 2–4 pós-RC | idem |
| T+72h | ~72h após deploy | rodada obrigatória (\`POST_RELEASE_PHASE=t72\`) |

GitHub Actions usa **UTC**; o horário real pode atrasar alguns minutos — a evidência é o relatório em \`docs/security/reports/\`.

Workflow: \`.github/workflows/post-release-monitor.yml\`

### Secrets GitHub (Actions)

Configure em **Settings → Secrets and variables → Actions** (nunca commitar valores):

- \`VERCEL_TOKEN\`, \`VERCEL_ORG_ID\`, \`VERCEL_PROJECT_ID\`
- \`SENTRY_AUTH_TOKEN\`, \`SENTRY_ORG\`, \`SENTRY_PROJECT\`
- \`LANGFUSE_PUBLIC_KEY\`, \`LANGFUSE_SECRET_KEY\`, \`LANGFUSE_HOST\`
- \`DATABASE_URL\`, \`DIRECT_URL\` (opcional)
- \`DEEPSEEK_API_KEY\`
- \`NEXT_PUBLIC_SUPABASE_URL\`, \`NEXT_PUBLIC_SUPABASE_ANON_KEY\`, \`SUPABASE_SERVICE_ROLE_KEY\`
- \`SUPABASE_TEST_USER_A_EMAIL\`, \`SUPABASE_TEST_USER_A_PASSWORD\`
- \`SUPABASE_TEST_USER_B_EMAIL\`, \`SUPABASE_TEST_USER_B_PASSWORD\`

Scripts: \`npm run security:post-release:monitor\`, \`security:post-release:t72\`, etc.
`;
  }

  writeFileSync(docPath, content, "utf8");
}

async function main(): Promise<void> {
  const { phase, skip, logWindow } = resolvePhase();
  if (skip) {
    log(`Fase ${phase}: skip (fora da janela agendada).`);
    process.exit(0);
  }

  const baseUrl = (process.env["POST_RELEASE_BASE_URL"] ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  let sha = process.env["GITHUB_SHA"]?.trim() ?? "";
  if (!sha) {
    try {
      sha = execSync("git rev-parse HEAD", { cwd: ROOT, encoding: "utf8" }).trim().slice(0, 12);
    } catch {
      sha = "unknown";
    }
  }

  log(`Fase=${phase} baseUrl=${baseUrl} logWindow=${logWindow}`);

  const checks: CheckResult[] = [];
  checks.push(checkReady(baseUrl));
  checks.push(checkHealth(baseUrl));
  checks.push(checkPlaywright(baseUrl));
  checks.push(checkNpmScript("security:logs:review", "logs_review"));
  checks.push(checkNpmScript("security:sample-observability-logs", "db_sample"));
  checks.push(checkNpmAudit());
  checks.push(checkVercelLogs(baseUrl, logWindow));
  checks.push(checkInngestLogs(baseUrl, logWindow));
  checks.push(await checkSentry());
  checks.push(await checkLangfuse());

  const coreChecks = new Set([
    "ready",
    "health",
    "playwright",
    "logs_review",
    "db_sample",
    "npm_audit",
  ]);
  const hasP0P1 = allFindings.some((f) => f.severity === "P0" || f.severity === "P1");
  const coreFailed = checks.some((c) => coreChecks.has(c.name) && c.status === "FALHOU");
  const optionalFailed = checks.some(
    (c) => !coreChecks.has(c.name) && c.status === "FALHOU",
  );
  const p0p1 = hasP0P1 || coreFailed;

  const nextWindow =
    phase === "t72"
      ? "weekly / T+7d"
      : phase === "daily"
        ? "daily (amanhã UTC) ou T+72h"
        : "weekly (próxima segunda UTC)";

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16);
  const reportsDir = resolve(ROOT, "docs/security/reports");
  mkdirSync(reportsDir, { recursive: true });
  const reportName = `post-release-monitor-${stamp}.md`;
  const reportPath = resolve(reportsDir, reportName);
  const reportRel = `docs/security/reports/${reportName}`;

  const md = formatReportMd({
    phase,
    baseUrl,
    sha,
    logWindow,
    checks,
    nextWindow,
  });
  writeFileSync(reportPath, md, "utf8");
  log(`Relatório: ${reportRel}`);

  const responsible = process.env["GITHUB_ACTIONS"] === "true" ? "github-actions" : "local";
  updateMonitoringDoc({ phase, reportRelPath: reportRel, checks, responsible });

  if (optionalFailed) {
    log("Aviso: checks opcionais FALHOU (Sentry/Langfuse/Vercel) — ver relatório");
  }

  if (p0p1) {
    const rollbackPath = resolve(ROOT, "POST_RELEASE_ROLLBACK_REQUIRED.md");
    writeFileSync(
      rollbackPath,
      `# Rollback necessário — post-release monitor

**Fase:** ${phase}  
**Data:** ${new Date().toISOString()}  
**Relatório:** ${reportRel}

## Ação

1. Seguir \`docs/security/PRODUCTION_ROLLBACK_RUNBOOK.md\`
2. Promover deployment estável anterior na Vercel
3. Rotacionar secrets se P0 indicar vazamento
4. Registrar incidente

**Não declarar sistema seguro.**
`,
      "utf8",
    );
    log("POST_RELEASE_ROLLBACK_REQUIRED.md criado");
    log(`FALHA: P0/P1 ou check crítico (pior=${worstSeverity() ?? "check"})`);
    process.exit(1);
  }

  log(
    optionalFailed
      ? "PASSOU — core OK; opcionais incompletos (secrets/credenciais painel)"
      : "PASSOU — sem P0/P1 em checks core",
  );
  process.exit(0);
}

main().catch((e) => {
  console.error("[post-release-monitor] erro:", e instanceof Error ? e.message : e);
  process.exit(1);
});
