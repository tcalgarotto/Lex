/**
 * Revisão da minuta: heurísticas locais + passagem assistida (DeepSeek).
 */

import { generateText } from "ai";
import { aiTelemetry } from "@/lib/ai/ai-telemetry";
import { getLanguageModelForLexTask, getProviderOptionsForLexTask } from "@/lib/ai/llm";
import type { ReviewIssue, ReviewIssueSeverity, ReviewResult } from "@/lib/cases/drafting/drafting-types";

const CRIT = "critico" as const;
const ALERTA = "alerta" as const;
const SUG = "sugestao" as const;

function rid() {
  return `rev-${Math.random().toString(36).slice(2, 10)}`;
}

function heuristicReview(content: string): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  const text = content;

  if (text.length < 200) {
    issues.push({
      id: rid(),
      severity: CRIT,
      message: "Texto muito curto para uma peça processual completa.",
      hint: "Amplie fatos, direito e pedidos antes de protocolar.",
    });
  }

  if (/TODO|TBD|\[ *\]|lacuna a complementar/i.test(text)) {
    issues.push({
      id: rid(),
      severity: ALERTA,
      message: "Há marcadores de lacuna ou trechos incompletos visíveis.",
      hint: "Revise a seção de lacunas e complete os dados faltantes.",
    });
  }

  if (/\b(STJ|STF|TRF\d|TJ[A-Z]{2,3})\b/i.test(text) && !/\bprocesso\b/i.test(text)) {
    issues.push({
      id: rid(),
      severity: SUG,
      message: "Há menção a tribunal sem referência clara ao documento processual.",
      hint: "Ao citar julgado, inclua número do processo após confirmação na fonte oficial.",
    });
  }

  if (!/^#\s+/m.test(text)) {
    issues.push({
      id: rid(),
      severity: SUG,
      message: "A minuta não usa títulos Markdown (#) — a exportação para Word fica menos estruturada.",
    });
  }

  if (/VERIFICAD|CERTID|CONFIRMAD[OA]\s+PELO\s+TRIBUNAL/i.test(text)) {
    issues.push({
      id: rid(),
      severity: CRIT,
      message: "Linguagem que sugere certidão ou verificação oficial sem suporte explícito no texto.",
      hint: "Prefira ‘candidata — confirmar fonte oficial’ quando aplicável.",
    });
  }

  return issues;
}

function sevMap(s: string): ReviewIssueSeverity {
  if (s === "critico" || s === "crítico") return CRIT;
  if (s === "alerta") return ALERTA;
  return SUG;
}

function parseLlmIssues(text: string): ReviewIssue[] | null {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  try {
    const v = JSON.parse(trimmed) as unknown;
    if (!v || typeof v !== "object") return null;
    const o = v as Record<string, unknown>;
    const raw = o["issues"];
    if (!Array.isArray(raw)) return null;
    const out: ReviewIssue[] = [];
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const it = item as Record<string, unknown>;
      const sev = typeof it["severity"] === "string" ? sevMap(it["severity"]) : SUG;
      const msg = typeof it["message"] === "string" ? it["message"] : "";
      if (!msg.trim()) continue;
      out.push({
        id: typeof it["id"] === "string" ? it["id"] : rid(),
        severity: sev,
        message: msg,
        hint: typeof it["hint"] === "string" ? it["hint"] : undefined,
      });
    }
    return out.length ? out : null;
  } catch {
    return null;
  }
}

function scoreFromIssues(issues: ReviewIssue[]): { score: number; verdict: string } {
  const crit = issues.filter((i) => i.severity === CRIT).length;
  const alerta = issues.filter((i) => i.severity === ALERTA).length;
  const score = Math.max(0, Math.min(1, 1 - crit * 0.35 - alerta * 0.15 - issues.length * 0.02));
  let verdict = "Pronto para exportar com revisão humana leve.";
  if (crit > 0) verdict = "Exige revisão — há pendências críticas.";
  else if (alerta > 0) verdict = "Exige revisão — há alertas antes de protocolar.";
  return { score, verdict };
}

async function deepseekReview(content: string): Promise<ReviewIssue[] | null> {
  const prompt = `Você revisa minuta processual brasileira (Markdown). Responda APENAS JSON válido:
{"issues":[{"id":"string","severity":"critico"|"alerta"|"sugestao","message":"string","hint":"string opcional"}]}

Regras:
- Aponte lacunas, incoerências fato/pedido, jurisprudência tratada como verificada quando for apenas candidata, fundamentos frágeis, clareza/estrutura.
- Não invente fatos. Não cite bases que não estejam no contexto fornecido.
- Se estiver adequada, devolva issues vazio.

Texto da minuta:
---
${content.slice(0, 45_000)}
---
`;

  const { text } = await generateText({
    model: getLanguageModelForLexTask("draft_review"),
    providerOptions: getProviderOptionsForLexTask("draft_review"),
    temperature: 0.15,
    maxOutputTokens: 3000,
    prompt,
    experimental_telemetry: aiTelemetry({
      functionId: "draft-review",
    }),
  });
  return parseLlmIssues(text);
}

/**
 * Revisão heurística + DeepSeek (sem segundo modelo paralelo além do configurado para peças).
 */
export async function reviewDraft(_draftId: string, _workspaceId: string, content: string): Promise<ReviewResult> {
  void _draftId;
  void _workspaceId;
  const h = heuristicReview(content);
  let llm: ReviewIssue[] = [];
  try {
    const parsed = await deepseekReview(content);
    if (parsed) llm = parsed;
  } catch {
    llm = [];
  }
  const issues = [...h, ...llm];
  const { score, verdict } = scoreFromIssues(issues);
  return { score, verdict, issues };
}
