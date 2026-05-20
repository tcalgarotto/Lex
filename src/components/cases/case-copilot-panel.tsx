import Link from "next/link";
import { Sparkles } from "lucide-react";
import type { CaseDetailRecord } from "@/app/(app)/cases/[id]/_load-case";
import type { ProceduralReadiness } from "@/lib/cases/brain-types";
import { isCasePreProcessual } from "@/lib/cases/labels";
import type { CockpitPrimaryAction } from "@/lib/cases/case-cockpit-primary-action";

const SHORTCUTS_MAX = 4;
const ATTENTION_MAX = 3;

export function CaseCopilotPanel({
  caseRecord: c,
  readiness,
  checklistMissingCount,
  primary,
}: {
  caseRecord: CaseDetailRecord;
  readiness: ProceduralReadiness | null;
  checklistMissingCount: number;
  primary: CockpitPrimaryAction;
}) {
  const pre = isCasePreProcessual(c);
  const openRiskCount = c.risks.filter((r) => !r.resolvedAt).length;

  const attention: string[] = [];
  if (checklistMissingCount > 0) {
    attention.push(`${checklistMissingCount} pendência${checklistMissingCount > 1 ? "s" : ""} na entrevista`);
  }
  if (c.documents.length === 0) {
    attention.push("Sem documento");
  }
  if (pre && !c.processNumber) {
    attention.push("Sem CNJ");
  }
  if (readiness?.missingDocuments?.length) {
    for (const m of readiness.missingDocuments) {
      if (typeof m === "string" && m.trim()) attention.push(m.trim());
    }
  }
  const attentionUnique = [...new Set(attention)];
  const attentionShown = attentionUnique.slice(0, ATTENTION_MAX);
  const attentionMore = Math.max(0, attentionUnique.length - ATTENTION_MAX);

  const shortcuts = [
    { href: `/cases/${c.id}/entrevista`, label: "Entrevista" },
    { href: `/cases/${c.id}/documentos`, label: "Enviar documento" },
    { href: `/cases/${c.id}/processo`, label: "Processo vinculado" },
    { href: `/cases/${c.id}/pesquisa-juridica`, label: "Pesquisa" },
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
      </div>

      <div className="rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay)]/60 px-3 py-2.5">
        <p className="text-micro font-semibold uppercase tracking-widest text-[color:var(--text-muted)]">Agora</p>
        <p className="mt-1 text-sm font-semibold leading-snug text-[color:var(--text-primary)]">{primary.label}</p>
      </div>

      {attentionShown.length > 0 ? (
        <div>
          <p className="text-caption font-semibold uppercase tracking-widest text-[color:var(--text-secondary)]">
            Atenção
          </p>
          <ul className="mt-1.5 space-y-1 text-caption leading-snug text-[color:var(--warning-text)]">
            {attentionShown.map((line) => (
              <li key={line}>· {line}</li>
            ))}
          </ul>
          {attentionMore > 0 ? (
            <p className="mt-1.5 text-caption text-[color:var(--text-muted)]">+{attentionMore} pendência(s)</p>
          ) : null}
        </div>
      ) : null}

      {openRiskCount > 0 ? (
        <p className="text-caption text-[color:var(--text-secondary)]">
          <span className="font-medium text-[color:var(--warning-text)]">{openRiskCount}</span> risco
          {openRiskCount > 1 ? "s" : ""} em aberto —{" "}
          <Link
            href={`/cases/${c.id}/partes-fatos`}
            className="text-[color:var(--brand-text)] underline-offset-2 hover:underline"
          >
            Fatos e partes
          </Link>
        </p>
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
              {s.label === "Pesquisa" ? <Sparkles className="size-3.5 shrink-0 opacity-80" aria-hidden /> : null}
              {s.label}
            </Link>
          ))}
        </div>
      </div>
    </aside>
  );
}
