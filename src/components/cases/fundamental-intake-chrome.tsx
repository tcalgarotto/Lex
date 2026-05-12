"use client";

import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { IntakeSectionId, SectionUiStatus } from "@/components/cases/fundamental-intake-helpers";
import { SECTION_ANCHOR } from "@/components/cases/fundamental-intake-helpers";

/** Alinhado aos 9 blocos do formulário (sem card “Revisão”). */
export type IntakeStepperSectionId = IntakeSectionId;

const STEP_ITEMS: Array<{ id: IntakeStepperSectionId; label: string }> = [
  { id: "attend", label: "Atendimento" },
  { id: "client", label: "Cliente" },
  { id: "opposing", label: "Contrária" },
  { id: "third", label: "Terceiros" },
  { id: "narrative", label: "Relato" },
  { id: "timeline", label: "Linha do tempo" },
  { id: "documents", label: "Provas" },
  { id: "goals", label: "Objetivo" },
  { id: "communication", label: "Comunicação" },
];

export function IntakeStepper({
  activeId,
  statuses,
  onNavigate,
}: {
  activeId: IntakeStepperSectionId;
  statuses: Record<IntakeStepperSectionId, SectionUiStatus>;
  onNavigate: (id: IntakeStepperSectionId) => void;
}) {
  function statusPhrase(s: SectionUiStatus): string {
    if (s === "complete") return "completo";
    if (s === "lacuna") return "com lacunas permitidas";
    return "incompleto";
  }

  return (
    <nav aria-label="Seções do formulário" className="lex-glass-card !overflow-visible w-full shrink-0 rounded-2xl px-2.5 py-2.5 sm:px-3 md:px-3.5 md:py-3">
      <div className="grid w-full min-w-0 grid-cols-9 gap-1 sm:gap-1.5 md:gap-2">
        {STEP_ITEMS.map(({ id, label }) => {
          const st = statuses[id] ?? "incomplete";
          const active = activeId === id;
          return (
            <button
              key={id}
              type="button"
              title={label}
              onClick={() => onNavigate(id)}
              aria-current={active ? "step" : undefined}
              aria-label={`${label}, ${statusPhrase(st)}`}
              className={cn(
                "flex min-h-[2.75rem] min-w-0 w-full items-center justify-center rounded-lg px-0.5 py-2 text-center text-[10px] font-semibold leading-tight transition-colors sm:rounded-xl sm:px-1.5 sm:py-2.5 sm:text-xs md:min-h-[2.875rem] md:px-2 md:text-[13px] lg:text-sm",
                active
                  ? "bg-violet-500/15 text-violet-100 ring-1 ring-inset ring-violet-500/40"
                  : "text-[color:var(--text-secondary)] hover:bg-white/[0.04] hover:text-[color:var(--text-primary)]",
              )}
            >
              <span className="block w-full truncate text-center">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function scrollToIntakeSection(id: IntakeSectionId) {
  const el = document.getElementById(SECTION_ANCHOR[id]);
  el?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function IntakeSidebarPanel({
  progress,
  pending,
  lacunas,
  nextLabel,
  onDraft,
  onStructure,
  loading,
  caseId,
  hideActions,
}: {
  progress: number;
  pending: string[];
  lacunas: string[];
  nextLabel: string;
  onDraft: () => void;
  onStructure: () => void;
  loading: "draft" | "structure" | "hydrate" | null;
  caseId: string | null;
  /** Mobile: só resumo; botões ficam na barra inferior. */
  hideActions?: boolean;
}) {
  return (
    <Card className="space-y-4 p-4 shadow-none md:p-5">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">
          Resumo do atendimento
        </p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-2xl font-semibold tabular-nums text-[color:var(--text-primary)]">{progress}%</span>
          <span className="text-xs text-[color:var(--text-secondary)]">Progresso</span>
        </div>
        <Progress value={progress} className="mt-2 h-2" />
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">
          Obrigatórios pendentes
        </p>
        {pending.length === 0 ? (
          <p className="mt-2 text-sm leading-relaxed text-emerald-200/90">Nenhuma pendência crítica aparente.</p>
        ) : (
          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm leading-relaxed text-amber-100/95">
            {pending.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">
          Lacunas permitidas
        </p>
        {lacunas.length === 0 ? (
          <p className="mt-2 text-sm text-[color:var(--text-secondary)]">Nenhuma lacuna marcada.</p>
        ) : (
          <ul className="mt-2 list-disc space-y-1 pl-4 text-sm leading-relaxed text-[color:var(--text-secondary)]">
            {lacunas.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="rounded-lg border border-[color:var(--border-default)]/60 bg-white/[0.02] p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-muted)]">
          Próxima etapa sugerida
        </p>
        <p className="mt-1 text-sm font-medium text-[color:var(--text-primary)]">{nextLabel}</p>
      </div>
      {!hideActions ? (
        <div className="flex flex-col gap-2 pt-1">
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            disabled={loading !== null}
            onClick={onDraft}
            data-testid="save-draft-sidebar"
          >
            {loading === "draft" ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Salvar rascunho
          </Button>
          <Button
            type="button"
            className="w-full bg-violet-600 text-white hover:bg-violet-500"
            disabled={loading !== null}
            onClick={onStructure}
            data-testid="save-structure-sidebar"
          >
            {loading === "structure" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
            Salvar e estruturar com DeepSeek
          </Button>
          {!caseId ? (
            <p className="text-center text-[11px] leading-snug text-[color:var(--text-muted)]">
              Salve o rascunho uma vez para receber o ID do caso e anexar documentos.
            </p>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

export function IntakeMobileActionBar({
  onDraft,
  onStructure,
  loading,
}: {
  onDraft: () => void;
  onStructure: () => void;
  loading: "draft" | "structure" | "hydrate" | null;
}) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--border-default)]/60 bg-[color:var(--surface-base)]/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md md:hidden"
      role="region"
      aria-label="Ações da entrevista"
    >
      <div className="mx-auto flex w-full max-w-lg gap-2">
        <Button
          type="button"
          variant="secondary"
          className="h-11 min-h-[44px] flex-1 text-[15px] font-medium"
          disabled={loading !== null}
          onClick={onDraft}
          data-testid="save-draft-mobile"
        >
          {loading === "draft" ? <Loader2 className="size-4 animate-spin" /> : "Rascunho"}
        </Button>
        <Button
          type="button"
          className="h-11 min-h-[44px] flex-[1.35] text-[14px] font-semibold"
          disabled={loading !== null}
          onClick={onStructure}
          data-testid="save-structure-mobile"
        >
          {loading === "structure" ? <Loader2 className="size-4 animate-spin" /> : "Estruturar"}
        </Button>
      </div>
    </div>
  );
}
