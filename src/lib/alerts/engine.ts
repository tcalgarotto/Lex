/**
 * Engine determinístico de alertas para a timeline jurídica viva.
 *
 * A partir de risks (ContradictionRisk), issues (LegalIssue) e métricas
 * de retrieval, gera um conjunto idempotente de alertas com kind/severity
 * mapeados ao domínio canônico (mudança jurisprudencial, tese enfraquecida,
 * risco crescente, etc).
 *
 * NÃO é responsável por persistir — devolve `AlertInput[]`. O caller decide.
 */

import { CaseAlertKind, CaseAlertSeverity } from "@prisma/client";
import type { AlertInput } from "./types";
import type { ContradictionRisk } from "@/lib/legal/reasoning/contradiction";
import type { LegalIssue } from "@/lib/legal/reasoning/issue-spotting";

export type DeriveAlertsArgs = {
  caseId?: string | null;
  /** Score 0..1 do retrieval atual. */
  groundingScore?: number;
  /** Score 0..1 anterior, p/ detectar tendência (risco crescente). */
  previousGroundingScore?: number;
  risks: ContradictionRisk[];
  issues: LegalIssue[];
};

const SEVERITY_FROM_RISK: Record<ContradictionRisk["severity"], CaseAlertSeverity> = {
  alta: CaseAlertSeverity.HIGH,
  media: CaseAlertSeverity.MEDIUM,
  baixa: CaseAlertSeverity.LOW,
};

function classifyRiskKind(r: ContradictionRisk): CaseAlertKind {
  const text = `${r.title} ${r.detail}`.toLowerCase();
  if (/revogad/.test(text)) return CaseAlertKind.NORM_REVOKED;
  if (/diverg/.test(text)) return CaseAlertKind.PRECEDENT_DIVERGENCE;
  if (/hist[óo]ric|vers[ãa]o/.test(text)) return CaseAlertKind.JURISPRUDENCE_DRIFT;
  if (/fragilid|fraco|tese.*frac|enfraquec/.test(text)) return CaseAlertKind.THESIS_WEAKENED;
  return CaseAlertKind.CONTEXTUAL_RISK;
}

export function deriveAlerts(args: DeriveAlertsArgs): AlertInput[] {
  const out: AlertInput[] = [];
  const caseId = args.caseId ?? null;

  for (const r of args.risks) {
    const kind = classifyRiskKind(r);
    const severity = SEVERITY_FROM_RISK[r.severity];
    out.push({
      kind,
      severity,
      title: r.title,
      message: r.detail,
      caseId,
      ...(r.evidence.normUrns[0] ? { reference: r.evidence.normUrns[0] } : {}),
      fingerprintExtras: ["risk", r.title, r.evidence.normUrns.join("|")],
      payload: {
        evidence: r.evidence,
        source: "contradiction",
      },
    });
  }

  if (args.issues.length >= 5) {
    out.push({
      kind: CaseAlertKind.STRATEGIC_HISTORY,
      severity: CaseAlertSeverity.LOW,
      title: "Múltiplos pontos jurídicos identificados",
      message: `Foram detectadas ${args.issues.length} questões jurídicas a endereçar nesta peça.`,
      caseId,
      fingerprintExtras: ["issues-bulk", String(args.issues.length)],
      payload: {
        topics: args.issues.slice(0, 8).map((i) => i.title),
      },
    });
  }

  if (
    typeof args.groundingScore === "number" &&
    typeof args.previousGroundingScore === "number" &&
    args.previousGroundingScore - args.groundingScore >= 0.15
  ) {
    out.push({
      kind: CaseAlertKind.RISING_RISK,
      severity: CaseAlertSeverity.HIGH,
      title: "Confiança de fundamentação caiu",
      message: `Grounding caiu de ${(args.previousGroundingScore * 100).toFixed(0)}% para ${(args.groundingScore * 100).toFixed(0)}%. Reavaliar fundamentos.`,
      caseId,
      fingerprintExtras: [
        "grounding-drop",
        args.previousGroundingScore.toFixed(2),
        args.groundingScore.toFixed(2),
      ],
      payload: {
        from: args.previousGroundingScore,
        to: args.groundingScore,
      },
    });
  }

  return out;
}
