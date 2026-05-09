/**
 * <CaseProgressBar /> — barra de etapas que dá ao advogado a sensação
 * de progresso ao longo da jornada de um caso (F1).
 *
 * Não modifica nada no banco — só lê o caso e infere milestones.
 * As 10 etapas:
 *  1. Caso criado
 *  2. Documento enviado
 *  3. Documento processado (INDEXED)
 *  4. Fatos extraídos
 *  5. Partes identificadas
 *  6. Pedidos identificados
 *  7. Inteligência do caso atualizada (Case Brain — F2)
 *  8. Fundamentos pinados (CaseLegalSource)
 *  9. Estratégia gerada (Case.metadataJson.strategy — F1 embed)
 * 10. Peça gerada
 * 11. (extra) Peça revisada — só conta como 10 (a última se houver review)
 */

import { Card } from "@/components/ui/card";
import { Check, Circle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type CaseProgressInput = {
  documents: { status: string }[];
  facts: { id: string }[];
  parties: { id: string }[];
  requests: { id: string }[];
  legalSources: { id: string }[];
  drafts: { id: string }[];
  reviews: { id: string }[];
  metadataJson: unknown;
};

type Milestone = {
  label: string;
  status: "done" | "pending" | "blocked";
};

function hasBrain(metadataJson: unknown): boolean {
  if (!metadataJson || typeof metadataJson !== "object") return false;
  const m = metadataJson as { brain?: unknown };
  return !!m.brain && typeof m.brain === "object";
}

function hasStrategy(metadataJson: unknown): boolean {
  if (!metadataJson || typeof metadataJson !== "object") return false;
  const m = metadataJson as { strategy?: unknown };
  return !!m.strategy && typeof m.strategy === "object";
}

function buildMilestones(c: CaseProgressInput): Milestone[] {
  const docsCount = c.documents.length;
  const docsIndexed = c.documents.filter((d) => d.status === "INDEXED").length;
  const docsFailed = c.documents.filter((d) => d.status === "FAILED").length;

  const milestones: Milestone[] = [
    { label: "Caso criado", status: "done" },
    {
      label: "Documento enviado",
      status: docsCount > 0 ? "done" : "pending",
    },
    {
      label: "Documento processado",
      status:
        docsIndexed > 0
          ? "done"
          : docsFailed > 0 && docsCount === docsFailed
            ? "blocked"
            : "pending",
    },
    {
      label: "Fatos extraídos",
      status: c.facts.length > 0 ? "done" : "pending",
    },
    {
      label: "Partes identificadas",
      status: c.parties.length > 0 ? "done" : "pending",
    },
    {
      label: "Pedidos identificados",
      status: c.requests.length > 0 ? "done" : "pending",
    },
    {
      label: "Inteligência do caso atualizada",
      status: hasBrain(c.metadataJson) ? "done" : "pending",
    },
    {
      label: "Fundamentos do caso pinados",
      status: c.legalSources.length > 0 ? "done" : "pending",
    },
    {
      label: "Estratégia gerada",
      status: hasStrategy(c.metadataJson) ? "done" : "pending",
    },
    {
      label: c.reviews.length > 0 ? "Peça revisada" : "Peça gerada",
      status:
        c.reviews.length > 0
          ? "done"
          : c.drafts.length > 0
            ? "done"
            : "pending",
    },
  ];
  return milestones;
}

export function CaseProgressBar({ caseData }: { caseData: CaseProgressInput }) {
  const milestones = buildMilestones(caseData);
  const done = milestones.filter((m) => m.status === "done").length;
  const total = milestones.length;
  const pct = Math.round((done / total) * 100);

  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
        <span>Progresso do caso</span>
        <span className="font-mono normal-case tracking-normal text-foreground/70">
          {done}/{total} · {pct}%
        </span>
      </div>
      <div
        className="mb-3 h-2 w-full overflow-hidden rounded-full bg-white/5"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all",
            pct >= 70
              ? "bg-emerald-500/70"
              : pct >= 40
                ? "bg-violet-500/70"
                : "bg-amber-500/60",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <ul className="grid gap-1 sm:grid-cols-2">
        {milestones.map((m) => (
          <li key={m.label} className="flex items-center gap-1.5 text-[12px]">
            {m.status === "done" ? (
              <Check className="size-3.5 text-emerald-300" />
            ) : m.status === "blocked" ? (
              <AlertTriangle className="size-3.5 text-rose-300" />
            ) : (
              <Circle className="size-3.5 text-muted-foreground/60" />
            )}
            <span
              className={cn(
                m.status === "done"
                  ? "text-foreground/90"
                  : m.status === "blocked"
                    ? "text-rose-200"
                    : "text-muted-foreground",
              )}
            >
              {m.label}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
