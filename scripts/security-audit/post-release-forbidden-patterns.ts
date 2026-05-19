/**
 * Padrões proibidos em logs/traces (post-release monitor).
 * Não imprimir matches com conteúdo sensível — só id + severity + contagem.
 */

export type MonitorSeverity = "P0" | "P1" | "P2" | "P3";

export type ForbiddenPattern = {
  id: string;
  query: string;
  severity: MonitorSeverity;
  /** Regex aplicada na linha de log agregada (mensagem). */
  messageRe: RegExp;
};

export const VERCEL_LOG_QUERIES: ForbiddenPattern[] = [
  {
    id: "service_role",
    query: "service_role",
    severity: "P0",
    messageRe: /service[_-]?role|SUPABASE_SERVICE_ROLE/i,
  },
  {
    id: "supabase_service_role",
    query: "SUPABASE_SERVICE_ROLE",
    severity: "P0",
    messageRe: /SUPABASE_SERVICE_ROLE/i,
  },
  {
    id: "deepseek_key",
    query: "DEEPSEEK_API_KEY",
    severity: "P0",
    messageRe: /DEEPSEEK_API_KEY|sk-[a-z0-9]{12,}/i,
  },
  {
    id: "sk_prefix",
    query: "sk-",
    severity: "P0",
    messageRe: /\bsk-[a-z0-9]{12,}/i,
  },
  {
    id: "bearer_jwt",
    query: "Bearer",
    severity: "P0",
    messageRe: /Bearer\s+eyJ|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./i,
  },
  {
    id: "jwt_eyj",
    query: "eyJ",
    severity: "P0",
    messageRe: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\./,
  },
  {
    id: "cookie_auth",
    query: "cookie",
    severity: "P0",
    messageRe: /\b(set-cookie|authorization):\s*[^\s]{20,}/i,
  },
  {
    id: "segredo_bravo",
    query: "segredo ultra confidencial Bravo",
    severity: "P0",
    messageRe: /segredo ultra confidencial Bravo/i,
  },
  {
    id: "extracted_text",
    query: "extractedText",
    severity: "P1",
    messageRe: /"extractedText"\s*:\s*"/i,
  },
  {
    id: "system_base",
    query: "SYSTEM_BASE",
    severity: "P1",
    messageRe: /SYSTEM_BASE|systemPrompt/i,
  },
  {
    id: "prompt_integral",
    query: "prompt integral",
    severity: "P1",
    messageRe: /prompt integral|documento integral|PDF integral/i,
  },
];

/** Classifica linha de log Inngest (operacional vs sensível). */
export function classifyInngestLogLine(line: string): {
  severity: MonitorSeverity | null;
  note: string;
} {
  if (/service_role|DEEPSEEK_API_KEY|sk-lf-|sk-[a-z0-9]{20,}|Bearer eyJ/i.test(line)) {
    return { severity: "P0", note: "possível secret em log inngest" };
  }
  if (/SYSTEM_BASE|prompt integral|extractedText/i.test(line)) {
    return { severity: "P1", note: "possível prompt/documento em log inngest" };
  }
  if (/NonRetriableError:\s*PDF_NO_TEXT/i.test(line)) {
    return { severity: "P3", note: "PDF sem texto (esperado em QA)" };
  }
  if (/POST \/api\/inngest\s+500/i.test(line) && !/secret|service_role/i.test(line)) {
    return { severity: "P2", note: "POST inngest 500 — revisar step" };
  }
  if (/POST \/api\/inngest\s+(400|206)/i.test(line)) {
    return { severity: "P3", note: "resposta Inngest step (400/206)" };
  }
  return { severity: null, note: "" };
}

export function scanTextForForbidden(
  text: string,
  extraRules?: Array<{ id: string; severity: MonitorSeverity; re: RegExp }>,
): Array<{ id: string; severity: MonitorSeverity; count: number }> {
  const hits = new Map<string, { id: string; severity: MonitorSeverity; count: number }>();
  const rules = [
    ...VERCEL_LOG_QUERIES.map((p) => ({
      id: p.id,
      severity: p.severity,
      re: p.messageRe,
    })),
    ...(extraRules ?? []),
  ];
  for (const line of text.split("\n")) {
    for (const rule of rules) {
      if (rule.re.test(line)) {
        const prev = hits.get(rule.id);
        hits.set(rule.id, {
          id: rule.id,
          severity: rule.severity,
          count: (prev?.count ?? 0) + 1,
        });
      }
    }
  }
  return [...hits.values()];
}
