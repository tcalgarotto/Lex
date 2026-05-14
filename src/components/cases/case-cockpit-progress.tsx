"use client";

/**
 * Barra e fases de progresso do cockpit (sem bloco duplicado de “próximo passo”).
 */

import type { DocumentStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import {
  buildPhases,
  computeProgressMetrics,
  type CaseProgressInput,
  type Phase,
  type Step,
  type StepStatus,
} from "@/lib/cases/case-progress-model";
import { deriveDocumentDisplayStatus } from "@/lib/documents/status-display";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const ICON: Record<StepStatus, string> = { done: "✓", pending: "·", blocked: "!" };

const STATUS_LABEL: Record<StepStatus, string> = {
  done: "Concluído",
  pending: "Pendente",
  blocked: "Bloqueado",
};

function StatusDot({ step }: { step: Step }) {
  return (
    <span
      title={step.label}
      className={cn(
        "flex size-3 shrink-0 items-center justify-center rounded-full border-[0.5px] text-[7px] leading-none",
        step.status === "done" &&
          "border-[color:var(--success-border)] bg-[color:var(--success-bg)] text-[color:var(--success-text)]",
        step.status === "pending" &&
          "border-[color:var(--border-default)] bg-[color:var(--surface-overlay)] text-[color:var(--text-disabled)]",
        step.status === "blocked" &&
          "border-[color:var(--danger-border)] bg-[color:var(--danger-bg)] text-[color:var(--danger-text)]",
      )}
      aria-hidden
    >
      {ICON[step.status]}
    </span>
  );
}

function PhaseCompact({ phase }: { phase: Phase }) {
  const done = phase.steps.filter((s) => s.status === "done").length;
  const n = phase.steps.length;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex min-w-0 flex-1 basis-0 cursor-default flex-col gap-1 rounded-lg border-[0.5px] px-2 py-1.5 text-left lex-transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-border)] sm:px-2.5",
            done === n
              ? "border-[color:var(--success-border)]/60 bg-[color:var(--success-bg)]/40"
              : "border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay)]",
          )}
          aria-label={`${phase.name}: ${done} de ${n} etapas concluídas. Abrir detalhes.`}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="truncate text-caption font-medium uppercase tracking-wide text-[color:var(--text-secondary)]">
              {phase.name}
            </span>
            <span className="shrink-0 font-mono text-caption text-[color:var(--text-muted)]">
              {done}/{n}
            </span>
          </div>
          <div className="flex flex-wrap gap-0.5" aria-hidden>
            {phase.steps.map((step) => (
              <StatusDot key={step.label} step={step} />
            ))}
          </div>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <p className="mb-1.5 text-caption font-semibold text-[color:var(--text-primary)]">{phase.name}</p>
        <ul className="space-y-1 text-caption text-[color:var(--text-secondary)]">
          {phase.steps.map((s) => (
            <li key={s.label} className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0">{ICON[s.status]}</span>
              <span>
                {s.label}
                <span className="ml-1 text-[color:var(--text-muted)]">({STATUS_LABEL[s.status]})</span>
              </span>
            </li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}

export function CaseCockpitProgress({ caseData }: { caseData: CaseProgressInput }) {
  const phases = buildPhases(caseData);
  const { doneCount, total, pct, nextStep } = computeProgressMetrics(phases);

  const stalled = caseData.documents.some((d) =>
    deriveDocumentDisplayStatus({
      status: d.status as DocumentStatus,
      updatedAt: d.updatedAt ?? Date.now(),
    }).stalled,
  );
  const needsAttention = stalled || nextStep?.status === "blocked";

  const barColor = needsAttention
    ? "var(--progress-mid)"
    : pct >= 100
      ? "var(--progress-high)"
      : "var(--brand-primary)";

  return (
    <TooltipProvider delayDuration={160}>
      <div className="border-t border-[color:var(--border-subtle)] pt-3 md:pt-3.5">
        <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
          <span className="text-caption font-semibold uppercase tracking-widest text-[color:var(--text-secondary)]">
            Progresso
          </span>
          <span
            className="rounded-full border-[0.5px] border-[color:var(--border-default)] px-2 py-0.5 font-mono text-caption text-[color:var(--text-secondary)]"
            style={{ background: "var(--surface-elevated)" }}
          >
            {doneCount} / {total}
          </span>
          <span className="font-mono text-caption text-[color:var(--text-muted)]">{pct}%</span>
        </div>

        <div
          className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--border-subtle)] sm:h-1"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progresso do caso: ${pct} por cento, ${doneCount} de ${total} etapas concluídas`}
        >
          <div
            className="h-full rounded-full lex-transition"
            style={{
              width: `${pct}%`,
              background: barColor,
            }}
          />
        </div>

        <div
          className="flex w-full flex-nowrap items-stretch gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Progresso por fase"
        >
          {phases.map((phase) => (
            <PhaseCompact key={phase.name} phase={phase} />
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}
