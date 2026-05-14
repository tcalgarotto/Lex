import Link from "next/link";
import { AlertTriangle, Sparkles } from "lucide-react";
import type { CaseDetailRecord } from "@/app/(app)/cases/[id]/_load-case";
import type { ProceduralReadiness } from "@/lib/cases/brain-types";
import { isCasePreProcessual } from "@/lib/cases/labels";
import type { CockpitPrimaryAction } from "@/lib/cases/case-cockpit-primary-action";
import type { CaseLegalWorkflowView } from "@/lib/cases/case-legal-workflow";

const SHORTCUTS_MAX = 4;
const BLOCKERS_MAX = 3;
const CRITERIA_MAX = 3;
const LACUNAS_MAX = 3;
const RISKS_MAX = 3;

export function CaseCopilotPanel({
  caseRecord: c,
  readiness,
  checklistMissingCount,
  primary,
  workflow,
}: {
  caseRecord: CaseDetailRecord;
  readiness: ProceduralReadiness | null;
  checklistMissingCount: number;
  primary: CockpitPrimaryAction;
  workflow: CaseLegalWorkflowView;
}) {
  const pre = isCasePreProcessual(c);
  const openRisks = c.risks.filter((r) => !r.resolvedAt);

  const lacunas: string[] = [];
  if (checklistMissingCount > 0) {
    lacunas.push(`Entrevista: ${checklistMissingCount} pendência(s)`);
  }
  if (c.documents.length === 0) {
    lacunas.push("Nenhum documento anexado");
  }
  if (pre && !c.processNumber) {
    lacunas.push("Sem CNJ vinculado (pré-processual)");
  }
  if (readiness?.missingDocuments?.length) {
    for (const m of readiness.missingDocuments) {
      if (typeof m === "string") lacunas.push(m);
    }
  }
  if (readiness?.blockers?.length) {
    for (const b of readiness.blockers) {
      if (typeof b === "string") lacunas.push(b);
    }
  }

  const lacunasUnique = [...new Set(lacunas)];
  const lacunasShown = lacunasUnique.slice(0, LACUNAS_MAX);
  const lacunasMore = Math.max(0, lacunasUnique.length - LACUNAS_MAX);

  const blockersShown = workflow.blockerMessages.slice(0, BLOCKERS_MAX);
  const criteriaShown = workflow.currentPhasePendingCriteria.slice(0, CRITERIA_MAX);

  const shortcuts = [
    { href: `/cases/${c.id}/entrevista`, label: "Entrevista guiada" },
    { href: `/cases/${c.id}/documentos`, label: "Documentos" },
    { href: `/cases/${c.id}/pesquisa-juridica`, label: "Pesquisa jurídica" },
    { href: `/cases/${c.id}/estrategia`, label: "Estratégia e peças" },
  ].slice(0, SHORTCUTS_MAX);

  return (
    <aside
      className="lex-glass w-full shrink-0 space-y-3 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay-strong)] p-4 xl:max-w-[20rem]"
      aria-label="Copiloto do caso"
    >
      <div>
        <p className="text-caption font-semibold uppercase tracking-widest text-[color:var(--text-secondary)]">
          Copiloto do caso
        </p>
        <p className="mt-2 text-caption font-semibold uppercase tracking-widest text-[color:var(--text-muted)]">
          Fase atual
        </p>
        <p className="text-sm font-semibold text-[color:var(--text-primary)]">{workflow.currentPhaseLabel}</p>
      </div>

      <div>
        <p className="text-caption font-semibold uppercase tracking-widest text-[color:var(--text-secondary)]">
          Próxima melhor ação
        </p>
        <p className="mt-0.5 text-sm text-[color:var(--brand-text)]">{primary.label}</p>
        <p className="mt-1 text-caption leading-relaxed text-[color:var(--text-secondary)]">{primary.description}</p>
      </div>

      {blockersShown.length > 0 ? (
        <div>
          <p className="text-caption font-semibold uppercase tracking-widest text-[color:var(--text-secondary)]">
            Bloqueadores
          </p>
          <ul className="mt-1.5 space-y-1 text-caption text-[color:var(--warning-text)]">
            {blockersShown.map((line) => (
              <li key={line} className="leading-snug">
                {line}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {criteriaShown.length > 0 ? (
        <div>
          <p className="text-caption font-semibold uppercase tracking-widest text-[color:var(--text-secondary)]">
            Critérios pendentes (fase atual)
          </p>
          <ul className="mt-1.5 list-inside list-disc space-y-1 text-caption text-[color:var(--text-secondary)]">
            {criteriaShown.map((line) => (
              <li key={line} className="leading-snug">
                {line}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {lacunasShown.length > 0 ? (
        <div>
          <p className="text-caption font-semibold uppercase tracking-widest text-[color:var(--text-secondary)]">
            Lacunas
          </p>
          <ul className="mt-1.5 list-inside list-disc space-y-1 text-caption text-[color:var(--text-secondary)]">
            {lacunasShown.map((line) => (
              <li key={line} className="leading-snug">
                {line}
              </li>
            ))}
          </ul>
          {lacunasMore > 0 ? (
            <p className="mt-1 text-caption text-[color:var(--text-muted)]">
              +{lacunasMore} pendência(s) — ver{" "}
              <Link href={`/cases/${c.id}`} className="text-[color:var(--brand-text)] underline-offset-2 hover:underline">
                Visão geral
              </Link>
              .
            </p>
          ) : null}
        </div>
      ) : null}

      {openRisks.length > 0 ? (
        <div>
          <p className="flex items-center gap-1 text-caption font-semibold uppercase tracking-widest text-[color:var(--text-secondary)]">
            <AlertTriangle className="size-3 text-[color:var(--warning-text)]" aria-hidden />
            Riscos
          </p>
          <ul className="mt-1.5 space-y-1 text-caption text-[color:var(--text-secondary)]">
            {openRisks.slice(0, RISKS_MAX).map((r) => (
              <li key={r.id} className="leading-snug">
                {r.title}
              </li>
            ))}
          </ul>
          {openRisks.length > RISKS_MAX ? (
            <p className="mt-1 text-caption text-[color:var(--text-muted)]">+{openRisks.length - RISKS_MAX} na Visão geral.</p>
          ) : null}
        </div>
      ) : null}

      <div className="border-t border-[color:var(--border-subtle)] pt-3">
        <p className="mb-2 text-caption font-semibold uppercase tracking-widest text-[color:var(--text-secondary)]">
          Atalhos
        </p>
        <div className="flex flex-col gap-1.5">
          {shortcuts.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="inline-flex items-center gap-1 text-sm text-[color:var(--brand-text)] underline-offset-2 hover:underline"
            >
              {s.label === "Estratégia e peças" ? <Sparkles className="size-3.5 shrink-0" aria-hidden /> : null}
              {s.label}
            </Link>
          ))}
        </div>
      </div>
    </aside>
  );
}
