import { cn } from "@/lib/utils";
import type { CaseLegalWorkflowView, WorkflowPhaseUi } from "@/lib/cases/case-legal-workflow";

function phaseClasses(p: WorkflowPhaseUi): string {
  switch (p.state) {
    case "done":
      return "border-[color:var(--success-border)]/70 bg-[color:var(--success-bg)]/35 text-[color:var(--success-text)]";
    case "current":
      return "border-[color:var(--brand-border)] bg-[color:var(--brand-subtle)] text-[color:var(--brand-text)] ring-2 ring-[color:var(--brand-border)]/50";
    case "blocked":
      return "border-[color:var(--warning-border)] bg-[color:var(--warning-bg)]/25 text-[color:var(--warning-text)]";
    default:
      return "border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay)] text-[color:var(--text-muted)]";
  }
}

export function CaseWorkflowRail({ workflow }: { workflow: CaseLegalWorkflowView }) {
  return (
    <div className="space-y-2 border-t border-[color:var(--border-subtle)] pt-3">
      <p className="text-caption font-semibold uppercase tracking-widest text-[color:var(--text-secondary)]">
        Fluxo do caso
      </p>
      <div
        className="flex w-full flex-nowrap items-center gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="list"
        aria-label="Fases do fluxo jurídico"
      >
        {workflow.phases.map((p, i) => (
          <div key={p.id} className="flex shrink-0 items-center gap-1">
            {i > 0 ? (
              <span className="px-0.5 text-[10px] text-[color:var(--text-disabled)]" aria-hidden>
                →
              </span>
            ) : null}
            <span
              role="listitem"
              title={[p.label, ...p.pendingCriteria].filter(Boolean).join(" · ")}
              className={cn(
                "whitespace-nowrap rounded-full border-[0.5px] px-2 py-1 text-caption font-medium lex-transition",
                phaseClasses(p),
              )}
            >
              {p.shortLabel}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
