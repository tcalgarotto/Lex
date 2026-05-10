"use client";

/**
 * P0 — Fluxo do caso reorganizado.
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/UX_FLOW_AUDIT.md
 */

import Link from "next/link";
import { ArrowRight, FileText, Search, Sparkles, ScrollText, AlertTriangle, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { deriveDocumentDisplayStatus } from "@/lib/documents/status-display";
import { DocumentUploadButton } from "@/components/documents/document-upload-button";
import { ReadinessCard } from "./case-readiness-card";
import { isCasePreProcessual, PRE_PROCESSUAL_MESSAGE } from "@/lib/cases/labels";
import type { ProceduralReadiness } from "@/lib/cases/brain-types";
import type {
  Case,
  CaseDraft,
  CaseFact,
  CaseLegalSource,
  CaseParty,
  CaseRequest,
  CaseReview,
  CaseRisk,
  Document,
  Process,
} from "@prisma/client";

type CaseOverview = Case & {
  facts: CaseFact[];
  parties: CaseParty[];
  requests: CaseRequest[];
  risks: CaseRisk[];
  drafts: CaseDraft[];
  reviews: CaseReview[];
  legalSources: CaseLegalSource[];
  documents: Pick<Document, "id" | "originalName" | "status" | "updatedAt">[];
  process: Pick<Process, "id" | "number" | "title" | "tribunal" | "vara"> | null;
};

interface CaseOverviewTabProps {
  caseData: CaseOverview;
}

type CaseRouteSeg = "documentos" | "partes-fatos" | "pesquisa-juridica" | "estrategia";

interface NextStep {
  label: string;
  /** Tom visual do step (ok=feito, alerta=pendente urgente, info=normal). */
  tone: "info" | "warning";
  action?: { kind: "route"; segment: CaseRouteSeg } | { kind: "link"; href: string };
}

function readBrainNarrative(metadataJson: unknown): string | null {
  if (!metadataJson || typeof metadataJson !== "object") return null;
  const m = metadataJson as { brain?: { narrative?: unknown } };
  if (!m.brain || typeof m.brain !== "object") return null;
  const n = m.brain.narrative;
  return typeof n === "string" && n.trim().length > 0 ? n : null;
}

type DocInconsistency = {
  kind: string;
  description: string;
  evidence?: string;
};

function readInconsistencies(metadataJson: unknown): DocInconsistency[] {
  if (!metadataJson || typeof metadataJson !== "object") return [];
  const m = metadataJson as { brain?: { inconsistencies?: unknown } };
  const list = m.brain?.inconsistencies;
  if (!Array.isArray(list)) return [];
  return list
    .filter((x): x is DocInconsistency =>
      !!x && typeof x === "object" && typeof (x as DocInconsistency).description === "string",
    )
    .slice(0, 6);
}

function readProceduralReadiness(metadataJson: unknown): ProceduralReadiness | null {
  if (!metadataJson || typeof metadataJson !== "object") return null;
  const m = metadataJson as { brain?: { proceduralReadiness?: unknown } };
  const r = m.brain?.proceduralReadiness;
  if (!r || typeof r !== "object") return null;
  const x = r as Partial<ProceduralReadiness>;
  if (typeof x.score !== "number" || typeof x.status !== "string") return null;
  return {
    score: x.score,
    status: x.status as ProceduralReadiness["status"],
    blockers: Array.isArray(x.blockers) ? x.blockers : [],
    missingDocuments: Array.isArray(x.missingDocuments) ? x.missingDocuments : [],
    nextBestAction: typeof x.nextBestAction === "string" ? x.nextBestAction : "",
    rationale: typeof x.rationale === "string" ? x.rationale : "",
  };
}

export function CaseOverviewTab({ caseData: c }: CaseOverviewTabProps) {
  const docsReady = c.documents.filter((d) => d.status === "INDEXED").length;
  const docsStalled = c.documents.filter(
    (d) => deriveDocumentDisplayStatus(d).stalled,
  ).length;
  const hasFacts = c.facts.length > 0;
  const hasRequests = c.requests.length > 0;
  const hasResearch = c.legalSources.length > 0;
  const hasDraft = c.drafts.length > 0;
  const preProcessual = isCasePreProcessual(c);
  const narrative = readBrainNarrative(c.metadataJson);
  const readiness = readProceduralReadiness(c.metadataJson);
  const inconsistencies = readInconsistencies(c.metadataJson);
  const docInconsistencyRisks = c.risks.filter(
    (r) => r.kind === "DOCUMENT_INCONSISTENCY" && !r.resolvedAt,
  );

  const steps: NextStep[] = [];
  if (docsStalled > 0) {
    steps.push({
      label: `${docsStalled} documento(s) travado(s) — reprocessar`,
      tone: "warning",
      action: { kind: "route", segment: "documentos" },
    });
  }
  if (c.documents.length === 0) {
    steps.push({
      label: "Enviar primeiro documento ao caso",
      tone: "info",
      action: { kind: "route", segment: "documentos" },
    });
  } else if (docsReady > 0 && !hasFacts) {
    steps.push({
      label: `Extrair fatos dos ${docsReady} documento(s) prontos`,
      tone: "info",
      action: { kind: "route", segment: "partes-fatos" },
    });
  } else if (hasFacts && !hasRequests) {
    steps.push({
      label: "Adicionar pedidos / consolidar partes",
      tone: "info",
      action: { kind: "route", segment: "partes-fatos" },
    });
  }
  if (hasFacts && !hasResearch) {
    steps.push({
      label: "Pesquisar fundamentos jurídicos aplicáveis",
      tone: "info",
      action: { kind: "route", segment: "pesquisa-juridica" },
    });
  }
  if (hasFacts && hasRequests && !hasDraft) {
    steps.push({
      label: "Gerar estratégia inicial e primeira peça",
      tone: "info",
      action: { kind: "route", segment: "estrategia" },
    });
  } else if (hasDraft) {
    steps.push({
      label: "Revisar última peça gerada",
      tone: "info",
      action: { kind: "route", segment: "estrategia" },
    });
  }

  return (
    <div className="space-y-4">
      {preProcessual ? (
        <Card className="border-violet-500/30 bg-violet-500/5 p-3 text-xs text-violet-100">
          <p className="leading-relaxed">{PRE_PROCESSUAL_MESSAGE}</p>
        </Card>
      ) : null}

      {narrative ? (
        <Card className="p-4 text-sm leading-relaxed">
          <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            Narrativa do caso
          </p>
          <p className="text-foreground/90">{narrative}</p>
        </Card>
      ) : c.summary ? (
        <Card className="p-4 text-sm leading-relaxed text-muted-foreground">{c.summary}</Card>
      ) : null}

      {readiness ? <ReadinessCard readiness={readiness} /> : null}

      {docInconsistencyRisks.length > 0 || inconsistencies.length > 0 ? (
        <Card className="border-amber-500/40 bg-amber-500/5 p-3">
          <div className="flex items-center gap-2 text-amber-200">
            <AlertTriangle className="size-4" />
            <p className="text-xs font-semibold uppercase tracking-wide">
              Inconsistências entre caso e documentos ({Math.max(docInconsistencyRisks.length, inconsistencies.length)})
            </p>
          </div>
          <ul className="mt-2 space-y-1 text-xs text-amber-100/90">
            {(docInconsistencyRisks.length > 0
              ? docInconsistencyRisks.slice(0, 4).map((r) => ({
                  kind: r.kind,
                  description: `${r.title}: ${r.detail}`,
                }))
              : inconsistencies.slice(0, 4)
            ).map((i, idx) => (
              <li key={`${i.kind}-${idx}`} className="leading-snug">
                <span className="font-mono text-[10px] uppercase opacity-75">{i.kind}</span>{" "}
                — {i.description}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-amber-200/70">
            Revise antes de gerar a peça — divergências de nome, CPF, data ou número de processo
            podem invalidar a minuta.
          </p>
        </Card>
      ) : null}

      <div className="grid gap-3 md:grid-cols-3">
        <StatBlock
          label="Documentos"
          value={`${c.documents.length}`}
          hint={`${docsReady} prontos${docsStalled ? ` · ${docsStalled} travados` : ""}`}
          icon={<FileText className="size-4" />}
          tone={docsStalled > 0 ? "warning" : c.documents.length === 0 ? "muted" : "ok"}
        />
        <StatBlock
          label="Fatos / Partes / Pedidos"
          value={`${c.facts.length} / ${c.parties.length} / ${c.requests.length}`}
          hint={`${c.risks.length} riscos sinalizados`}
          icon={<Sparkles className="size-4" />}
          tone={hasFacts ? "ok" : "muted"}
        />
        <StatBlock
          label="Pesquisa & Peças"
          value={`${c.legalSources.length} / ${c.drafts.length}`}
          hint={`fundamentos do caso / peças`}
          icon={<ScrollText className="size-4" />}
          tone={hasDraft ? "ok" : hasResearch ? "info" : "muted"}
        />
      </div>

      {c.process ? (
        <Card className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Processo judicial vinculado
              </p>
              <p className="font-mono text-sm">{c.process.number}</p>
              {c.process.title ? (
                <p className="text-xs text-muted-foreground">{c.process.title}</p>
              ) : null}
              <div className="flex flex-wrap gap-1 pt-1">
                {c.process.tribunal ? (
                  <Badge variant="outline" className="text-[10px]">
                    {c.process.tribunal}
                  </Badge>
                ) : null}
                {c.process.vara ? (
                  <Badge variant="outline" className="text-[10px]">
                    {c.process.vara}
                  </Badge>
                ) : null}
              </div>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href={`/processos/${c.process.id}`}>
                Abrir <ArrowRight className="ml-1 size-3" />
              </Link>
            </Button>
          </div>
        </Card>
      ) : preProcessual ? (
        <Card className="p-4 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="leading-relaxed">
              Este caso ainda é pré-processual.{" "}
              <span className="text-foreground/70">
                Vincule um processo existente ou marque como protocolado quando o protocolo sair.
              </span>
            </p>
            <Button asChild variant="ghost" size="sm">
              <Link href={`/processos?returnCase=${c.id}`}>
                <Hash className="mr-1 size-3" /> Vincular processo existente
              </Link>
            </Button>
          </div>
        </Card>
      ) : null}

      {steps.length > 0 ? (
        <Card className="p-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
            Próximos passos
          </p>
          <ul className="space-y-1.5">
            {steps.map((s) => {
              const inner = (
                <span
                  className={`inline-flex items-center gap-1 ${
                    s.tone === "warning"
                      ? "text-amber-200 hover:text-amber-100"
                      : "text-violet-300 hover:text-violet-200"
                  }`}
                >
                  {s.tone === "warning" ? <AlertTriangle className="size-3" aria-hidden /> : null}
                  {s.label} <ArrowRight className="size-3" aria-hidden />
                </span>
              );
              if (!s.action) return <li key={s.label} className="text-sm">{inner}</li>;
              if (s.action.kind === "link") {
                return (
                  <li key={s.label} className="text-sm">
                    <Link href={s.action.href} className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                      {inner}
                    </Link>
                  </li>
                );
              }
              return (
                <li key={s.label} className="text-sm">
                  <Link
                    href={`/cases/${c.id}/${s.action.segment}`}
                    className="rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    {inner}
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2 pt-2">
        <DocumentUploadButton caseId={c.id} label="Enviar documento" />
        <Button type="button" variant="secondary" size="sm" asChild>
          <Link href={`/cases/${c.id}/pesquisa-juridica`}>
            <Search className="mr-1 size-3" aria-hidden /> Pesquisar fundamentos no caso
          </Link>
        </Button>
        <Button type="button" variant="secondary" size="sm" asChild>
          <Link href={`/cases/${c.id}/estrategia`}>
            <Sparkles className="mr-1 size-3" aria-hidden /> Gerar estratégia
          </Link>
        </Button>
      </div>
    </div>
  );
}

const TONE_BORDER: Record<"ok" | "info" | "warning" | "muted", string> = {
  ok: "border-emerald-500/20",
  info: "border-violet-500/20",
  warning: "border-amber-500/30",
  muted: "border-white/10",
};

function StatBlock({
  label,
  value,
  hint,
  icon,
  tone = "muted",
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
  tone?: "ok" | "info" | "warning" | "muted";
}) {
  return (
    <Card className={`p-3 ${TONE_BORDER[tone]}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon} {label}
      </div>
      <p className="mt-1 text-xl font-semibold">{value}</p>
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </Card>
  );
}
