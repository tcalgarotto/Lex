/**
 * Varredura estática de logs/observabilidade (sem imprimir conteúdo sensível).
 * Usado por `review-logs-static.ts` e testes.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export type LogSeverity = "P0" | "P1" | "P2" | "P3";

export type LogReviewFinding = {
  severity: LogSeverity;
  file: string;
  line: number;
  pattern: string;
  note: string;
  fix: string;
};

const SKIP_DIR_NAMES = new Set([
  "node_modules",
  ".next",
  "coverage",
  "dist",
  "build",
  ".git",
  ".turbo",
  "tests",
]);

const SKIP_FILE_RE = /\.(test|spec)\.(ts|tsx)$/;

const ALLOWLIST_KEY_RE =
  /^\s*(workspaceId|userId|documentId|caseId|requestId|status|durationMs|queryLen|chunkCount|provider|errorCode|promptVersion|promptTokens|completionTokens|totalTokens|contentLen|outputLen|event|channel|leadId|model|traceId|engine|cached|ok|action|entity|counts|layers|scope|query|err|name|latencyMs|retrievalChunkIds)\s*:/;

const SINK_LINE_RE =
  /console\.(log|info|debug|warn|error)\s*\(|\b(?:log|logger)\.(info|warn|error|debug)\s*\(|recordObservabilityLog\s*\(|Sentry\.(captureException|captureMessage)\s*\(|(?:^|[^\w])trace\s*\(|\.trace\s*\(|\.generation\s*\(|generation\s*\(|\.span\s*\(|\.event\s*\(|payloadJson\s*:/i;

const P0_RULES: Array<{ id: string; re: RegExp; note: string; fix: string }> = [
  {
    id: "service_role",
    re: /service[_-]?role|SUPABASE_SERVICE_ROLE/i,
    note: "service role em sink de log",
    fix: "Nunca logar service_role; usar ID de workspace e status.",
  },
  {
    id: "api_key",
    re: /DEEPSEEK_API_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY|OPENROUTER_API_KEY|DEEPINFRA_API_KEY/i,
    note: "API key em sink de log",
    fix: "Remover env/secret do log; usar errorCode genérico.",
  },
  {
    id: "jwt_bearer",
    re: /Bearer\s+eyJ|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./i,
    note: "JWT/Bearer em sink de log",
    fix: "Não logar tokens; mascarar via scrubSecrets.",
  },
  {
    id: "oauth_token",
    re: /\b(access_token|refresh_token)\b/i,
    note: "token OAuth em sink de log",
    fix: "Logar apenas tokenId ou presença booleana.",
  },
  {
    id: "cookie_auth",
    re: /\b(cookie|set-cookie|authorization)\b/i,
    note: "cookie/authorization em sink de log",
    fix: "Não logar headers de auth; usar userId da sessão.",
  },
];

const P1_RULES: Array<{ id: string; re: RegExp; note: string; fix: string }> = [
  {
    id: "system_prompt",
    re: /systemPrompt|SYSTEM_BASE/i,
    note: "system prompt em sink de log",
    fix: "Não logar SYSTEM_BASE; usar promptVersion/hash.",
  },
  {
    id: "prompt_body",
    re: /\bprompt\s*:|,\s*prompt\s*[,}]|log\.[^(]+\([^)]*prompt/i,
    note: "prompt completo em sink de log",
    fix: "Logar promptLen ou hash, não o texto.",
  },
  {
    id: "messages_body",
    re: /\binput:\s*messages\s*(?:[,)]|$)(?!\.map)|log\.[^(]+\([^)]*\bmessages\b/i,
    note: "messages completas em sink/observability",
    fix: "Enviar ao provider off-band; no log só roles e contentLen.",
  },
  {
    id: "llm_output_full",
    re: /\boutput:\s*text\b|output:\s*event\.text/i,
    note: "resposta LLM integral em observability",
    fix: "Logar outputLen; texto só no DB com ACL.",
  },
  {
    id: "document_text",
    re: /extractedText|documentText|rawText|fullText|pdfText/i,
    note: "texto integral de documento em sink",
    fix: "Logar documentId + textLen; nunca o PDF/texto cru.",
  },
];

const P2_RULES: Array<{ id: string; re: RegExp; note: string; fix: string }> = [
  {
    id: "pii_cpf_cnpj",
    re: /\bcpf\b|\bcnpj\b/i,
    note: "CPF/CNPJ em sink de log",
    fix: "Mascarar via scrubSecrets ou omitir.",
  },
  {
    id: "pii_contact",
    re: /\btelefone\b|\bphone\b|\bemail\b|\boab\b/i,
    note: "contato/PII em sink de log",
    fix: "Usar scrubPii ou chaves mascaradas.",
  },
  {
    id: "pii_process",
    re: /\bprocesso\b|\bcnj\b/i,
    note: "identificador processual em sink de log",
    fix: "Preferir processId/CNJ mascarado.",
  },
];

const P3_RULES: Array<{ id: string; re: RegExp; note: string; fix: string }> = [
  {
    id: "payload_json_large",
    re: /payloadJson\s*:\s*\{[^}]{120,}/i,
    note: "payloadJson potencialmente grande",
    fix: "Manter payloadJson mínimo (IDs, lens, counts).",
  },
];

function isSkippedDir(name: string): boolean {
  return SKIP_DIR_NAMES.has(name);
}

export function walkSourceFiles(root: string, out: string[] = []): string[] {
  if (!statSync(root).isDirectory()) return out;
  for (const name of readdirSync(root)) {
    const p = join(root, name);
    if (statSync(p).isDirectory()) {
      if (!isSkippedDir(name)) walkSourceFiles(p, out);
    } else if (/\.(ts|tsx)$/.test(name) && !SKIP_FILE_RE.test(name)) {
      out.push(p);
    }
  }
  return out;
}

function isAllowlistedContext(line: string, ruleId: string): boolean {
  const t = line.trim();
  if (ALLOWLIST_KEY_RE.test(t)) {
    if (ruleId === "prompt_body" && /\bprompt(Version|Tokens)\b/i.test(t)) return true;
    if (ruleId === "pii_contact" && /\b(email|phone)(Len|Count)?\s*:/i.test(t)) return true;
    if (ruleId === "document_text" && /(Len|Count|Preview)\s*:/i.test(t)) return true;
    return true;
  }
  if (ruleId === "prompt_body" && /\bprompt(Version|Tokens)\b/i.test(t)) return true;
  if (ruleId === "messages_body" && /\bcontentLen\b/i.test(t)) return true;
  if (ruleId === "llm_output_full" && /\boutputLen\b/i.test(t)) return true;
  if (ruleId === "document_text" && /\b(textLen|textPreview|queryLen)\b/i.test(t)) return true;
  return false;
}

function isSinkLine(line: string): boolean {
  return SINK_LINE_RE.test(line);
}

/** Linhas que pertencem ao argumento do sink (parênteses balanceados). */
function sinkArgumentLineIndexes(lines: string[], startLine: number): number[] {
  const indexes: number[] = [];
  let depth = 0;
  let started = false;
  const maxLines = Math.min(lines.length, startLine + 14);
  for (let i = startLine; i < maxLines; i++) {
    indexes.push(i);
    const line = lines[i] ?? "";
    for (const ch of line) {
      if (ch === "(") {
        depth += 1;
        started = true;
      } else if (ch === ")") {
        depth -= 1;
      }
    }
    if (started && depth <= 0) break;
  }
  return indexes;
}

function scanWindow(
  relFile: string,
  lines: string[],
  startLine: number,
  findings: LogReviewFinding[],
  seen: Set<string>,
) {
  const lineIndexes = sinkArgumentLineIndexes(lines, startLine);
  for (const i of lineIndexes) {
    const line = lines[i] ?? "";
    if (!line.trim() || line.trim().startsWith("//")) continue;

    const rules: Array<{ severity: LogSeverity; rule: (typeof P0_RULES)[0] }> = [
      ...P0_RULES.map((rule) => ({ severity: "P0" as const, rule })),
      ...P1_RULES.map((rule) => ({ severity: "P1" as const, rule })),
      ...P2_RULES.map((rule) => ({ severity: "P2" as const, rule })),
      ...P3_RULES.map((rule) => ({ severity: "P3" as const, rule })),
    ];

    for (const { severity, rule } of rules) {
      if (!rule.re.test(line)) continue;
      if (isAllowlistedContext(line, rule.id)) continue;
      const key = `${relFile}:${i + 1}:${severity}:${rule.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push({
        severity,
        file: relFile,
        line: i + 1,
        pattern: rule.id,
        note: rule.note,
        fix: rule.fix,
      });
    }
  }
}

function toRelPath(scanRoot: string, absPath: string): string {
  const normRoot = scanRoot.endsWith("/") ? scanRoot.slice(0, -1) : scanRoot;
  if (absPath.startsWith(normRoot + "/")) return absPath.slice(normRoot.length + 1);
  if (absPath.startsWith(normRoot + "\\")) return absPath.slice(normRoot.length + 1);
  return absPath;
}

export function scanDirectory(scanRoot: string): LogReviewFinding[] {
  const findings: LogReviewFinding[] = [];
  const seen = new Set<string>();
  const files = walkSourceFiles(scanRoot);

  for (const absPath of files) {
    const rel = toRelPath(scanRoot, absPath);
    const lines = readFileSync(absPath, "utf8").split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      if (!isSinkLine(line)) continue;
      scanWindow(rel, lines, i, findings, seen);
    }
  }

  return findings;
}

export type LogReviewSummary = {
  findings: LogReviewFinding[];
  bySeverity: Record<LogSeverity, number>;
};

export function summarize(findings: LogReviewFinding[]): LogReviewSummary {
  const bySeverity: Record<LogSeverity, number> = { P0: 0, P1: 0, P2: 0, P3: 0 };
  for (const f of findings) bySeverity[f.severity] += 1;
  return { findings, bySeverity };
}

export function formatReport(summary: LogReviewSummary, scopeLabel: string): string[] {
  const lines: string[] = [];
  lines.push(`[logs-review] Escopo: ${scopeLabel}`);
  lines.push(
    `[logs-review] Totais — P0=${summary.bySeverity.P0} P1=${summary.bySeverity.P1} P2=${summary.bySeverity.P2} P3=${summary.bySeverity.P3}`,
  );
  const order: LogSeverity[] = ["P0", "P1", "P2", "P3"];
  for (const sev of order) {
    const group = summary.findings.filter((f) => f.severity === sev);
    if (group.length === 0) continue;
    const label = sev === "P2" || sev === "P3" ? `AVISO ${sev}` : sev;
    lines.push(`[logs-review] —— ${label} (${group.length}) ——`);
    for (const f of group) {
      lines.push(`[logs-review] ${label} ${f.file}:${f.line} pattern=${f.pattern} — ${f.note}`);
      lines.push(`[logs-review]     correção: ${f.fix}`);
    }
  }
  if (summary.bySeverity.P0 === 0 && summary.bySeverity.P1 === 0) {
    lines.push("[logs-review] OK — nenhum P0/P1 em sinks de log no escopo.");
  }
  lines.push(
    "[logs-review] PENDENTE: amostragem real Vercel/Sentry/Langfuse/produção (fora deste script).",
  );
  lines.push("[logs-review] Não declarar sistema seguro.");
  return lines;
}

export function exitCodeFor(summary: LogReviewSummary): number {
  if (summary.bySeverity.P0 > 0 || summary.bySeverity.P1 > 0) return 1;
  return 0;
}
