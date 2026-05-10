/**
 * P0 — Estratégia e Peças (drafting + review + export).
 * Drafting-guard ativo; jurisprudência candidata não promovida sem confirmação humana.
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/features/CASE_DRAFTING_TAB.md
 */

import type { ReviewIssue, ReviewResult } from "@/lib/cases/drafting/drafting-types";

const CRIT = "critico" as const;
const ALERTA = "alerta" as const;
const SUG = "sugestao" as const;

function id() {
  return `rev-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Revisão heurística da minuta (sem segundo modelo por padrão — previsível e barato).
 * TODO Lane E: opcional passagem complementar por modelo com orçamento dedicado.
 */
export async function reviewDraft(_draftId: string, _workspaceId: string, content: string): Promise<ReviewResult> {
  void _draftId;
  void _workspaceId;
  const issues: ReviewIssue[] = [];
  const text = content;

  if (text.length < 200) {
    issues.push({
      id: id(),
      severity: CRIT,
      message: "Texto muito curto para uma peça processual completa.",
      hint: "Amplie fatos, direito e pedidos antes de protocolar.",
    });
  }

  if (/TODO|TBD|\[ *\]|lacuna a complementar/i.test(text)) {
    issues.push({
      id: id(),
      severity: ALERTA,
      message: "Há marcadores de lacuna ou trechos incompletos visíveis.",
      hint: "Revise a seção de lacunas e complete os dados faltantes.",
    });
  }

  if (/\b(STJ|STF|TRF\d|TJ[A-Z]{2,3})\b/i.test(text) && !/\bprocesso\b/i.test(text)) {
    issues.push({
      id: id(),
      severity: SUG,
      message: "Há menção a tribunal sem referência clara ao documento processual.",
      hint: "Ao citar julgado, inclua número do processo após confirmação na fonte oficial.",
    });
  }

  if (!/^#\s+/m.test(text)) {
    issues.push({
      id: id(),
      severity: SUG,
      message: "A minuta não usa títulos Markdown (#) — a exportação para Word fica menos estruturada.",
    });
  }

  if (/VERIFICAD|CERTID|CONFIRMAD[OA]\s+PELO\s+TRIBUNAL/i.test(text)) {
    issues.push({
      id: id(),
      severity: CRIT,
      message: "Linguagem que sugere certidão ou verificação oficial sem suporte explícito no texto.",
      hint: "Prefira ‘candidata — confirmar fonte oficial’ quando aplicável.",
    });
  }

  const crit = issues.filter((i) => i.severity === CRIT).length;
  const alerta = issues.filter((i) => i.severity === ALERTA).length;
  const score = Math.max(0, Math.min(1, 1 - crit * 0.35 - alerta * 0.15 - issues.length * 0.02));

  let verdict = "Minuta com boa aderência às checagens automáticas.";
  if (crit > 0) verdict = "Há pendências críticas antes de protocolar.";
  else if (alerta > 0) verdict = "Há alertas — revisão humana recomendada.";

  return { score, verdict, issues };
}
