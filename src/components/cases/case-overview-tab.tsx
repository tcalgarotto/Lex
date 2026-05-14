"use client";

/**
 * P0 — Fluxo do caso reorganizado.
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/UX_FLOW_AUDIT.md
 */

import Link from "next/link";
import { ArrowRight, Search, Sparkles, AlertTriangle, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { deriveDocumentDisplayStatus } from "@/lib/documents/status-display";
import { DocumentUploadButton } from "@/components/documents/document-upload-button";
import { ReadinessCard } from "./case-readiness-card";
import { isCasePreProcessual } from "@/lib/cases/labels";
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
 CaseTimelineEvent,
 Document,
 Process,
} from "@prisma/client";
import { CaseTimelineTab } from "@/components/cases/case-timeline-tab";
import { CaseCollabTab } from "@/components/cases/case-collab-tab";

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
 timeline: CaseTimelineEvent[];
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

function readIntakeFundamental(metadataJson: unknown): {
  nextSteps: string[];
  missingQuestions: string[];
} | null {
  if (!metadataJson || typeof metadataJson !== "object") return null;
  const m = metadataJson as { intakeFundamental?: unknown };
  const x = m.intakeFundamental;
  if (!x || typeof x !== "object") return null;
  const o = x as { nextSteps?: unknown; missingQuestions?: unknown };
  const nextSteps = Array.isArray(o.nextSteps) ? o.nextSteps.filter((s): s is string => typeof s === "string") : [];
  const missingQuestions = Array.isArray(o.missingQuestions)
    ? o.missingQuestions.filter((s): s is string => typeof s === "string")
    : [];
  if (nextSteps.length === 0 && missingQuestions.length === 0) return null;
  return { nextSteps, missingQuestions };
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
 const intakeFundamental = readIntakeFundamental(c.metadataJson);
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
      {narrative ? (
        <Card className="p-4 text-sm leading-relaxed">
          <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Narrativa do caso</p>
          <p className="text-foreground/90">{narrative}</p>
        </Card>
      ) : c.summary && c.summary.replace(/\s+/g, " ").trim().length > 200 ? (
        <Card className="p-4 text-sm leading-relaxed text-muted-foreground">
          <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">Descrição completa</p>
          <p>{c.summary}</p>
        </Card>
      ) : null}

      {readiness ? <ReadinessCard readiness={readiness} /> : null}

      {intakeFundamental ? (
        <Card className="border-violet-500/25 bg-violet-500/[0.04] p-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
            Entrevista fundamental
          </p>
          {intakeFundamental.nextSteps.length > 0 ? (
            <ul className="mb-3 space-y-1.5 text-sm text-foreground/90">
              {intakeFundamental.nextSteps.slice(0, 3).map((s, i) => (
                <li key={`ns-${i}`} className="flex gap-2 leading-snug">
                  <span className="font-mono text-[10px] text-violet-300/90">{i + 1}.</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {intakeFundamental.nextSteps.length > 3 ? (
            <p className="mb-3 text-caption text-muted-foreground">
              +{intakeFundamental.nextSteps.length - 3} próximo(s) passo(s) na entrevista
            </p>
          ) : null}
          {intakeFundamental.missingQuestions.length > 0 ? (
            <div className="text-xs text-muted-foreground">
              <p className="mb-1 font-medium text-foreground/80">Perguntas sugeridas</p>
              <ul className="list-disc space-y-1 pl-4">
                {intakeFundamental.missingQuestions.slice(0, 4).map((q, i) => (
                  <li key={`mq-${i}`}>{q}</li>
                ))}
              </ul>
              {intakeFundamental.missingQuestions.length > 4 ? (
                <p className="mt-2 text-caption text-muted-foreground">
                  +{intakeFundamental.missingQuestions.length - 4} sugestões
                </p>
              ) : null}
            </div>
          ) : null}
        </Card>
      ) : null}

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
 <p className="mt-2 text-caption leading-snug text-amber-200/80">
 Revise antes de gerar a peça (dados divergentes).
 </p>
 </Card>
 ) : null}

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
 <Card className="p-3 text-sm text-muted-foreground">
 <div className="flex flex-wrap items-center justify-between gap-2">
 <p className="min-w-0 leading-snug">Pré-processual — vincule o CNJ quando houver número.</p>
 <Button asChild variant="outline" size="sm" className="shrink-0">
 <Link href={`/processos?returnCase=${c.id}`}>
 <Hash className="mr-1 size-3" /> Importar CNJ
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
 ? "text-[color:var(--warning-text)] hover:opacity-90"
 : "text-[color:var(--brand-text)] hover:opacity-90"
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
 <Button
 type="button"
 variant="outline"
 size="sm"
 asChild
 className="border-[0.5px] border-[color:var(--border-default)] bg-[color:var(--surface-overlay)] text-[color:var(--text-primary)] hover:bg-[color:var(--surface-overlay-strong)]"
 >
 <Link href={`/cases/${c.id}/pesquisa-juridica`}>
 <Search className="mr-1 size-3" aria-hidden /> Pesquisar fundamentos
 </Link>
 </Button>
 <Button
 type="button"
 variant="outline"
 size="sm"
 asChild
 className="border-[0.5px] border-[color:var(--border-default)] bg-[color:var(--surface-overlay)] text-[color:var(--text-primary)] hover:bg-[color:var(--surface-overlay-strong)]"
 >
 <Link href={`/cases/${c.id}/estrategia`}>
 <Sparkles className="mr-1 size-3" aria-hidden /> Gerar estratégia
 </Link>
 </Button>
 </div>

 <section
 className="space-y-4 border-t border-[color:var(--border-subtle)] pt-8"
 aria-labelledby="case-activity-heading"
 >
 <h2
 id="case-activity-heading"
 className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--text-muted)]"
 >
 Atividades e colaboração
 </h2>
 <CaseTimelineTab events={c.timeline} />
 <CaseCollabTab caseId={c.id} />
 </section>
 </div>
 );
}
