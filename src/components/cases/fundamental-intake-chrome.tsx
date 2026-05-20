"use client";

import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { IntakeSectionId, SectionUiStatus } from "@/components/cases/fundamental-intake-helpers";
import { SECTION_ANCHOR } from "@/components/cases/fundamental-intake-helpers";
import {
  INTAKE_GUIDED_STEPS,
  INTAKE_REVIEW_ANCHOR,
  guidedStepStatus,
  type IntakeGuidedStepId,
} from "@/lib/cases/fundamental-intake/intake-guided-flow";

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

function intakeSectionStatusPhrase(s: SectionUiStatus): string {
  if (s === "complete") return "completo";
  if (s === "lacuna") return "com lacunas permitidas";
  return "incompleto";
}

/** Navegação em coluna (card na sidebar desktop). */
export function IntakeStepperVertical({
  activeId,
  statuses,
  onNavigate,
}: {
  activeId: IntakeStepperSectionId;
  statuses: Record<IntakeStepperSectionId, SectionUiStatus>;
  onNavigate: (id: IntakeStepperSectionId) => void;
}) {
  return (
    <Card className="shadow-none">
      <div className="border-b border-[color:var(--border-default)]/50 px-4 py-3 md:px-5">
        <p className="text-sm font-semibold leading-snug text-[color:var(--text-secondary)]">Navegação</p>
      </div>
      <nav aria-label="Navegação do formulário" className="flex flex-col gap-0.5 p-2 md:p-2.5">
        {STEP_ITEMS.map(({ id, label }) => {
          const st = statuses[id] ?? "incomplete";
          const active = activeId === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              aria-current={active ? "step" : undefined}
              aria-label={`${label}, ${intakeSectionStatusPhrase(st)}`}
              className={cn(
                "flex w-full min-w-0 items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium leading-snug transition-colors md:py-2.5",
                active
                  ? "bg-violet-500/15 text-violet-100 ring-1 ring-inset ring-violet-500/40"
                  : "text-[color:var(--text-secondary)] hover:bg-white/[0.04] hover:text-[color:var(--text-primary)]",
              )}
            >
              <span className="min-w-0 flex-1">{label}</span>
              <span
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  st === "complete" && "bg-emerald-400/90",
                  st === "lacuna" && "bg-amber-400/90",
                  st === "incomplete" && "bg-[color:var(--text-disabled)]/80",
                )}
                title={intakeSectionStatusPhrase(st)}
                aria-hidden
              />
            </button>
          );
        })}
      </nav>
    </Card>
  );
}

export function IntakeStepper({
  activeId,
  statuses,
  onNavigate,
}: {
  activeId: IntakeStepperSectionId;
  statuses: Record<IntakeStepperSectionId, SectionUiStatus>;
  onNavigate: (id: IntakeStepperSectionId) => void;
}) {
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
              aria-label={`${label}, ${intakeSectionStatusPhrase(st)}`}
              className={cn(
                "flex min-h-[2.75rem] min-w-0 w-full items-center justify-center rounded-lg px-0.5 py-2 text-center text-xs font-semibold leading-snug transition-colors sm:rounded-xl sm:px-1.5 sm:py-2.5 sm:text-sm md:min-h-[2.875rem] md:px-2 md:text-sm",
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

export function scrollToGuidedStep(scrollTo: IntakeSectionId | "review") {
  if (scrollTo === "review") {
    document.getElementById(INTAKE_REVIEW_ANCHOR)?.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  scrollToIntakeSection(scrollTo);
}

/** Stepper por tópicos da entrevista guiada (Fase 3). */
export function IntakeGuidedStepper({
  activeId,
  sectionStatuses,
  onNavigate,
}: {
  activeId: IntakeGuidedStepId;
  sectionStatuses: Record<IntakeSectionId, SectionUiStatus>;
  onNavigate: (id: IntakeGuidedStepId) => void;
}) {
  return (
    <nav
      aria-label="Etapas da entrevista guiada"
      className="lex-glass-card w-full shrink-0 overflow-x-auto rounded-2xl px-2 py-2"
    >
      <div className="flex min-w-max gap-1.5">
        {INTAKE_GUIDED_STEPS.map((step, idx) => {
          const st = guidedStepStatus(step, sectionStatuses);
          const active = activeId === step.id;
          const statusHint =
            st === "complete" ? " — completo" : st === "lacuna" ? " — lacuna" : " — incompleto";
          return (
            <button
              key={step.id}
              type="button"
              title={`${step.description}${statusHint}`}
              onClick={() => onNavigate(step.id)}
              aria-current={active ? "step" : undefined}
              className={cn(
                "flex max-w-[11rem] min-w-[7.5rem] flex-col rounded-lg border px-2.5 py-2 text-left transition-colors",
                active
                  ? "border-violet-500/50 bg-violet-500/15 text-violet-100"
                  : "border-transparent text-[color:var(--text-secondary)] hover:bg-white/[0.04]",
              )}
            >
              <span className="text-[10px] font-medium text-muted-foreground">{idx + 1}</span>
              <span className="text-xs font-semibold leading-snug">{step.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function IntakeSidebarPanel({
  progress,
  pending,
  lacunas,
  nextLabel,
  onDraft,
  onStructure,
  loading,
  hideActions,
  structureLocked,
  structureLockTitle,
  organizeButtonLabel = "Organizar caso com Lex AI",
}: {
  progress: number;
  pending: string[];
  lacunas: string[];
  nextLabel: string;
  onDraft: () => void;
  onStructure: () => void;
  loading: "save" | "structure" | "hydrate" | null;
  /** Mobile: só resumo; botões ficam na barra inferior. */
  hideActions?: boolean;
  /** Quando true, desativa só o botão "Organizar caso com Lex AI" até o formulário estar completo. */
  structureLocked?: boolean;
  /** Texto para `title` / acessibilidade quando Lex está bloqueada. */
  structureLockTitle?: string;
  organizeButtonLabel?: string;
}) {
  return (
    <Card className="space-y-4 p-4 shadow-none md:p-5">
      <div>
        <p className="text-sm font-semibold leading-snug text-[color:var(--text-secondary)]">
          Resumo do atendimento
        </p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-2xl font-semibold tabular-nums text-[color:var(--text-primary)]">{progress}%</span>
          <span className="text-sm font-medium text-[color:var(--text-secondary)]">Progresso</span>
        </div>
        <Progress value={progress} className="mt-2 h-2" />
      </div>
      <div>
        <p className="text-sm font-semibold leading-snug text-[color:var(--text-secondary)]">
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
        <p className="text-sm font-semibold leading-snug text-[color:var(--text-secondary)]">
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
        <p className="text-sm font-semibold leading-snug text-[color:var(--text-secondary)]">
          Próxima etapa sugerida
        </p>
        <p className="mt-1 text-base font-medium leading-relaxed text-[color:var(--text-primary)]">{nextLabel}</p>
      </div>
      {!hideActions ? (
        <div className="flex flex-col gap-2 pt-1">
          <Button
            type="button"
            className="h-auto min-h-[44px] w-full py-2.5 text-control font-semibold"
            disabled={loading !== null}
            onClick={onDraft}
            data-testid="save-case-sidebar"
          >
            {loading === "save" ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Salvar caso
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-auto min-h-[44px] w-full border-violet-500/40 py-2.5 text-control font-semibold text-violet-100 hover:bg-violet-500/10"
            disabled={loading !== null || Boolean(structureLocked)}
            title={structureLocked ? structureLockTitle : undefined}
            onClick={onStructure}
            data-testid="save-structure-sidebar"
          >
            {loading === "structure" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
            {organizeButtonLabel}
          </Button>
          <p className="text-xs leading-relaxed text-[color:var(--text-secondary)]">
            {organizeButtonLabel.startsWith("Reorganizar")
              ? "Atualiza partes, fatos, pedidos e riscos a partir da entrevista salva, preservando o relato."
              : "Organize automaticamente partes, fatos, pedidos e riscos a partir do relato salvo. Opcional."}
          </p>
        </div>
      ) : null}
    </Card>
  );
}

export function IntakeMobileActionBar({
  onDraft,
  onStructure,
  loading,
  structureLocked,
  structureLockTitle,
  organizeButtonLabel = "Organizar caso com Lex AI",
}: {
  onDraft: () => void;
  onStructure: () => void;
  loading: "save" | "structure" | "hydrate" | null;
  structureLocked?: boolean;
  structureLockTitle?: string;
  organizeButtonLabel?: string;
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
          className="h-11 min-h-[44px] flex-1 text-control font-medium"
          disabled={loading !== null}
          onClick={onDraft}
          data-testid="save-case-mobile"
        >
          {loading === "save" ? <Loader2 className="size-4 animate-spin" /> : "Salvar caso"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 min-h-[44px] flex-[1.35] border-violet-500/40 text-[14px] font-semibold"
          disabled={loading !== null || Boolean(structureLocked)}
          title={structureLocked ? structureLockTitle : undefined}
          onClick={onStructure}
          data-testid="save-structure-mobile"
        >
          {loading === "structure" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : organizeButtonLabel.startsWith("Reorganizar") ? (
            "Reorganizar"
          ) : (
            "Organizar"
          )}
        </Button>
      </div>
    </div>
  );
}
