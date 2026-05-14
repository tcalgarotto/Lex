import Link from "next/link";
import { Calendar, Building2, ChevronRight, Clock, Hash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CaseCockpitActions } from "@/components/cases/case-cockpit-actions";
import { CaseCockpitMetricChips } from "@/components/cases/case-cockpit-metric-chips";
import { CaseCockpitProgress } from "@/components/cases/case-cockpit-progress";
import { CaseWorkflowRail } from "@/components/cases/case-workflow-rail";
import { caseStatusLabel, isCasePreProcessual } from "@/lib/cases/labels";
import { getTribunal } from "@/lib/corpus/tribunals/registry";
import type { ProceduralReadiness } from "@/lib/cases/brain-types";
import type { CaseDetailRecord } from "@/app/(app)/cases/[id]/_load-case";
import type { CockpitPrimaryAction } from "@/lib/cases/case-cockpit-primary-action";
import type { CaseLegalWorkflowView } from "@/lib/cases/case-legal-workflow";

function splitCaseTitle(title: string): { primary: string; secondary: string | null } {
  const seps = [" — ", " – ", " —", "– ", " - "];
  for (const sep of seps) {
    const i = title.indexOf(sep);
    if (i > 0 && i + sep.length < title.length) {
      const a = title.slice(0, i).trim();
      const b = title.slice(i + sep.length).trim();
      if (a && b) return { primary: a, secondary: b };
    }
  }
  return { primary: title, secondary: null };
}

export function CaseCockpitHeader({
  caseRecord: c,
  workspaceLabel,
  readiness,
  primaryAction,
  workflow,
}: {
  caseRecord: CaseDetailRecord;
  workspaceLabel: string;
  readiness: ProceduralReadiness | null;
  primaryAction: CockpitPrimaryAction;
  workflow: CaseLegalWorkflowView;
}) {
  const tribunal = c.tribunalCode ? getTribunal(c.tribunalCode) : null;
  const preProcessual = isCasePreProcessual(c);
  const { primary, secondary } = splitCaseTitle(c.title);

  return (
    <header className="lex-glass lex-transition space-y-3 rounded-xl p-4 md:space-y-3.5 md:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-x-4 sm:gap-y-2">
        <nav
          className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-sm"
          aria-label="Navegação do caso"
        >
          <Link
            href="/cases"
            className="font-medium text-[color:var(--text-muted)] lex-transition hover:text-[color:var(--text-primary)]"
          >
            Casos
          </Link>
          <ChevronRight className="size-3.5 shrink-0 text-[color:var(--text-disabled)]" aria-hidden />
          <span className="max-w-[140px] truncate text-[color:var(--text-secondary)] md:max-w-xs">
            {workspaceLabel}
          </span>
          <ChevronRight className="size-3.5 shrink-0 text-[color:var(--text-disabled)]" aria-hidden />
          <span
            className="max-w-[200px] truncate font-medium text-[color:var(--text-primary)] md:max-w-md"
            title={c.title}
          >
            Detalhe do caso
          </span>
        </nav>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <Badge
            variant="secondary"
            className="border-[0.5px] border-[color:var(--border-default)] text-caption uppercase tracking-wide text-[color:var(--text-secondary)]"
          >
            {caseStatusLabel(c.status)}
          </Badge>
          {preProcessual ? (
            <Badge
              variant="outline"
              className="border-[0.5px] border-[color:var(--brand-border)] bg-[color:var(--brand-subtle)] text-caption text-[color:var(--brand-text)]"
            >
              <Clock className="mr-1 size-3" aria-hidden /> Pré-processual
            </Badge>
          ) : null}
          <Badge
            variant="outline"
            className="border-[0.5px] border-[color:var(--border-default)] text-caption text-[color:var(--text-secondary)]"
          >
            <Calendar className="mr-1 size-3" aria-hidden />
            {new Date(c.createdAt).toLocaleDateString("pt-BR")}
          </Badge>
          {tribunal ? (
            <Badge
              variant="outline"
              className="border-[0.5px] border-[color:var(--border-default)] text-caption text-[color:var(--text-secondary)]"
            >
              <Building2 className="mr-1 size-3" aria-hidden /> {tribunal.code} · {tribunal.name}
            </Badge>
          ) : null}
          {c.uf ? (
            <Badge
              variant="outline"
              className="border-[0.5px] border-[color:var(--border-default)] text-caption text-[color:var(--text-secondary)]"
            >
              {c.uf}
            </Badge>
          ) : null}
          {c.processNumber ? (
            <Badge
              variant="outline"
              className="border-[0.5px] border-[color:var(--border-default)] font-mono text-caption text-[color:var(--text-secondary)]"
            >
              <Hash className="mr-1 size-3" aria-hidden />
              {c.processNumber}
            </Badge>
          ) : null}
          {preProcessual && !c.processNumber ? (
            <Badge
              variant="outline"
              className="max-w-[220px] truncate border-[0.5px] border-[color:var(--border-default)] text-caption text-[color:var(--text-secondary)]"
              title="Vincule o CNJ quando houver protocolo."
            >
              Sem CNJ
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <div>
          <h1 className="text-xl font-semibold leading-snug tracking-tight text-[color:var(--text-primary)] md:text-2xl">
            {primary}
          </h1>
          {secondary ? (
            <p className="mt-1 text-sm font-medium leading-snug text-[color:var(--text-secondary)]">{secondary}</p>
          ) : null}
        </div>
        {c.summary ? (
          <p
            className="max-w-3xl text-sm leading-relaxed text-[color:var(--text-secondary)] line-clamp-2"
            title={c.summary}
          >
            {c.summary}
          </p>
        ) : null}
        <CaseCockpitMetricChips caseId={c.id} caseRecord={c} />
      </div>

      <p className="flex flex-wrap gap-x-3 gap-y-1 text-caption text-[color:var(--text-muted)]">
        <span>Criado em {workflow.flowMetrics.createdLabel}</span>
        <span>Última atividade {workflow.flowMetrics.updatedLabel}</span>
        {workflow.flowMetrics.readinessScore != null ? (
          <span>Prontidão {workflow.flowMetrics.readinessScore}%</span>
        ) : null}
        {workflow.flowMetrics.stalledDocuments > 0 ? (
          <span className="text-[color:var(--warning-text)]">
            Docs travados: {workflow.flowMetrics.stalledDocuments}
          </span>
        ) : null}
        {workflow.flowMetrics.openRisks > 0 ? (
          <span>Riscos em aberto: {workflow.flowMetrics.openRisks}</span>
        ) : null}
      </p>

      {workflow.blockerMessages.length > 0 ? (
        <ul
          className="rounded-lg border border-[color:var(--warning-border)]/40 bg-[color:var(--warning-bg)]/15 px-3 py-2 text-caption text-[color:var(--warning-text)]"
          aria-label="Políticas e bloqueios do fluxo"
        >
          {workflow.blockerMessages.slice(0, 2).map((msg) => (
            <li key={msg} className="leading-snug">
              {msg}
            </li>
          ))}
        </ul>
      ) : null}

      <CaseWorkflowRail workflow={workflow} />

      <div className="flex flex-col gap-3 border-t border-[color:var(--border-subtle)] pt-3 md:flex-row md:items-start md:justify-between md:gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-caption font-semibold uppercase tracking-widest text-[color:var(--text-secondary)]">
            Próximo passo
          </p>
          <p className="text-base font-semibold text-[color:var(--text-primary)]">{primaryAction.label}</p>
          <p className="text-sm leading-relaxed text-[color:var(--text-secondary)]">{primaryAction.description}</p>
        </div>
        <CaseCockpitActions
          caseId={c.id}
          primary={primaryAction}
          readiness={readiness}
          archived={Boolean(c.archivedAt)}
        />
      </div>

      <CaseCockpitProgress caseData={c} />
    </header>
  );
}
