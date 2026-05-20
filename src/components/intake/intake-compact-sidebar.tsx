"use client";

import * as React from "react";
import { ChevronDown, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { IntakeSectionId, SectionUiStatus } from "@/components/cases/fundamental-intake-helpers";
import { SECTION_ANCHOR } from "@/components/cases/fundamental-intake-helpers";
import type { ComplementCheckItem } from "@/lib/cases/fundamental-intake/intake-complement-checklist";
import { IntakeComplementChecklistPanel } from "@/components/cases/intake-complement-checklist-panel";

const NAV_ITEMS: Array<{ id: IntakeSectionId; label: string }> = [
  { id: "attend", label: "Atendimento" },
  { id: "client", label: "Cliente" },
  { id: "opposing", label: "Contrária" },
  { id: "third", label: "Terceiros" },
  { id: "narrative", label: "Relato" },
  { id: "timeline", label: "Cronologia" },
  { id: "documents", label: "Provas" },
  { id: "goals", label: "Objetivo" },
  { id: "communication", label: "Gestão" },
];

function statusDot(st: SectionUiStatus) {
  return cn(
    "size-1.5 shrink-0 rounded-full",
    st === "complete" && "bg-emerald-400/90",
    st === "lacuna" && "bg-amber-400/90",
    st === "incomplete" && "bg-muted-foreground/50",
  );
}

/**
 * Sidebar compacta: progresso, próxima pergunta, até 3 lacunas, nav/checklist colapsáveis, ações.
 */
export function IntakeCompactSidebar({
  progress,
  nextQuestion,
  highlightItems,
  activeSectionId,
  sectionStatuses,
  onNavigateSection,
  checklistItems,
  onDraft,
  onStructure,
  loading,
  hideActions,
  structureLocked,
  structureLockTitle,
  organizeButtonLabel = "Organizar caso com Lex AI",
}: {
  progress: number;
  nextQuestion: string;
  highlightItems: string[];
  activeSectionId: IntakeSectionId;
  sectionStatuses: Record<IntakeSectionId, SectionUiStatus>;
  onNavigateSection: (id: IntakeSectionId) => void;
  checklistItems: ComplementCheckItem[];
  onDraft: () => void;
  onStructure: () => void;
  loading: "save" | "structure" | "hydrate" | null;
  hideActions?: boolean;
  structureLocked?: boolean;
  structureLockTitle?: string;
  organizeButtonLabel?: string;
}) {
  const [navOpen, setNavOpen] = React.useState(false);
  const [checklistOpen, setChecklistOpen] = React.useState(false);

  return (
    <aside
      className="flex w-full min-w-0 flex-col gap-3 rounded-xl border border-[color:var(--border-default)]/40 bg-[color:var(--surface-overlay-strong)]/40 p-3 md:max-w-[260px]"
      aria-label="Resumo da entrevista"
    >
      <div>
        <div className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
          <span>Progresso</span>
          <span className="tabular-nums text-foreground">{progress}%</span>
        </div>
        <Progress value={progress} className="mt-1.5 h-1.5" />
      </div>

      <div className="rounded-lg border border-violet-500/25 bg-violet-500/[0.06] px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-200/80">
          Próxima pergunta
        </p>
        <p className="mt-1 text-sm font-medium leading-snug text-foreground">{nextQuestion}</p>
      </div>

      {highlightItems.length > 0 ? (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Atenção agora
          </p>
          <ul className="mt-1.5 space-y-1">
            {highlightItems.map((item) => (
              <li key={item} className="text-xs leading-snug text-amber-100/90">
                • {item}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-emerald-200/90">Nenhuma pendência crítica no momento.</p>
      )}

      <details
        className="group rounded-md border border-[color:var(--border-default)]/40"
        open={navOpen}
        onToggle={(e) => setNavOpen(e.currentTarget.open)}
      >
        <summary className="flex cursor-pointer list-none items-center justify-between px-2.5 py-2 text-xs font-semibold text-muted-foreground [&::-webkit-details-marker]:hidden">
          Ir para seção
          <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
        </summary>
        <nav className="flex flex-col gap-0.5 px-1 pb-2" aria-label="Seções do formulário">
          {NAV_ITEMS.map(({ id, label }) => {
            const st = sectionStatuses[id] ?? "incomplete";
            const active = activeSectionId === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  const el = document.getElementById(SECTION_ANCHOR[id]);
                  el?.scrollIntoView({ behavior: "smooth", block: "start" });
                  onNavigateSection(id);
                }}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium",
                  active ? "bg-violet-500/15 text-violet-100" : "text-muted-foreground hover:bg-white/[0.04]",
                )}
              >
                <span className={statusDot(st)} aria-hidden />
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </nav>
      </details>

      <details
        className="group rounded-md border border-[color:var(--border-default)]/40"
        open={checklistOpen}
        onToggle={(e) => setChecklistOpen(e.currentTarget.open)}
      >
        <summary
          className="flex cursor-pointer list-none items-center justify-between px-2.5 py-2 text-xs font-semibold text-muted-foreground [&::-webkit-details-marker]:hidden"
          data-testid="intake-checklist-toggle"
        >
          Ver checklist completo
          <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
        </summary>
        <div className="px-1 pb-2">
          <IntakeComplementChecklistPanel items={checklistItems} compact />
        </div>
      </details>

      {!hideActions ? (
        <div className="mt-auto flex flex-col gap-2 border-t border-[color:var(--border-default)]/40 pt-3">
          <Button
            type="button"
            className="h-10 w-full text-sm font-semibold"
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
            className="h-10 w-full border-violet-500/40 text-sm font-semibold text-violet-100"
            disabled={loading !== null || Boolean(structureLocked)}
            title={structureLocked ? structureLockTitle : undefined}
            onClick={onStructure}
            data-testid="save-structure-sidebar"
          >
            {loading === "structure" ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 size-4" />
            )}
            {organizeButtonLabel}
          </Button>
        </div>
      ) : null}
    </aside>
  );
}
