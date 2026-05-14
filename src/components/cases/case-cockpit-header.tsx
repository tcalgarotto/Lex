import Link from "next/link";
import { Building2, ChevronRight, Clock, Hash } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CaseCockpitActions } from "@/components/cases/case-cockpit-actions";
import { CaseCockpitMetricChips } from "@/components/cases/case-cockpit-metric-chips";
import { CaseCockpitProgress } from "@/components/cases/case-cockpit-progress";
import { isCasePreProcessual } from "@/lib/cases/labels";
import { getTribunal } from "@/lib/corpus/tribunals/registry";
import type { ProceduralReadiness } from "@/lib/cases/brain-types";
import type { CaseDetailRecord } from "@/app/(app)/cases/[id]/_load-case";
import type { CockpitPrimaryAction } from "@/lib/cases/case-cockpit-primary-action";
import type { CaseLegalWorkflowView } from "@/lib/cases/case-legal-workflow";
import { splitCaseTitle } from "@/lib/cases/case-title-display";
import { cn } from "@/lib/utils";

/** Até 3 chips de saúde operacional (complementam as métricas de navegação). */
function CockpitHealthChips({ workflow }: { workflow: CaseLegalWorkflowView }) {
  const items: { key: string; label: string; warn?: boolean }[] = [];
  if (workflow.flowMetrics.stalledDocuments > 0) {
    items.push({
      key: "stalled",
      label: `Docs travados: ${workflow.flowMetrics.stalledDocuments}`,
      warn: true,
    });
  }
  if (workflow.flowMetrics.openRisks > 0) {
    items.push({
      key: "risks",
      label: `Riscos: ${workflow.flowMetrics.openRisks}`,
      warn: true,
    });
  }
  if (workflow.flowMetrics.readinessScore != null) {
    items.push({
      key: "ready",
      label: `Prontidão ${workflow.flowMetrics.readinessScore}%`,
    });
  }
  const shown = items.slice(0, 3);
  if (shown.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2" aria-label="Saúde do caso">
      {shown.map((it) => (
        <span
          key={it.key}
          className={cn(
            "inline-flex rounded-full border-[0.5px] border-[color:var(--border-default)] bg-[color:var(--surface-overlay)] px-2.5 py-1 text-caption font-medium text-[color:var(--text-secondary)]",
            it.warn && "border-[color:var(--warning-border)]/50 text-[color:var(--warning-text)]",
          )}
        >
          {it.label}
        </span>
      ))}
    </div>
  );
}

export function CaseCockpitHeader({
  caseRecord: c,
  readiness,
  checklistMissingCount,
  primaryAction,
  workflow,
}: {
  caseRecord: CaseDetailRecord;
  readiness: ProceduralReadiness | null;
  checklistMissingCount: number;
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
          className="flex min-w-0 flex-1 flex-nowrap items-center gap-1 overflow-x-auto text-sm [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Navegação do caso"
        >
          <Link
            href="/cases"
            className="font-medium text-[color:var(--text-muted)] lex-transition hover:text-[color:var(--text-primary)]"
          >
            Casos
          </Link>
          <ChevronRight className="size-3.5 shrink-0 text-[color:var(--text-disabled)]" aria-hidden />
          <span
            className="min-w-0 max-w-[min(100%,42rem)] truncate font-medium text-[color:var(--text-primary)]"
            title={primary}
          >
            {primary}
          </span>
        </nav>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <Badge
            variant="outline"
            className="max-w-[min(100%,12rem)] truncate border-[0.5px] border-[color:var(--brand-border)] bg-[color:var(--brand-subtle)] text-caption text-[color:var(--brand-text)]"
            title={workflow.currentPhaseLabel}
          >
            {workflow.currentPhaseLabel}
          </Badge>
          {preProcessual ? (
            <Badge
              variant="outline"
              className="border-[0.5px] border-[color:var(--border-default)] text-caption text-[color:var(--text-secondary)]"
            >
              <Clock className="mr-1 size-3" aria-hidden /> Pré-processual
            </Badge>
          ) : null}
          {tribunal ? (
            <Badge
              variant="outline"
              className="hidden max-w-[10rem] truncate border-[0.5px] border-[color:var(--border-default)] text-caption text-[color:var(--text-secondary)] sm:inline-flex"
              title={`${tribunal.code} · ${tribunal.name}`}
            >
              <Building2 className="mr-1 size-3 shrink-0" aria-hidden /> {tribunal.code}
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
        <CaseCockpitMetricChips caseId={c.id} caseRecord={c} checklistMissingCount={checklistMissingCount} />
        <CockpitHealthChips workflow={workflow} />
      </div>

      <div className="flex flex-col gap-3 border-t border-[color:var(--border-subtle)] pt-3 md:flex-row md:items-center md:justify-between md:gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-caption font-semibold uppercase tracking-widest text-[color:var(--text-secondary)]">
            Próxima ação
          </p>
          <p className="mt-0.5 text-base font-semibold text-[color:var(--text-primary)]">{primaryAction.label}</p>
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
