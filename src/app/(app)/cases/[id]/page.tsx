import { notFound } from "next/navigation";
import Link from "next/link";
import { getWorkspaceContext } from "@/lib/auth/session";
import { CaseOverviewTab } from "@/components/cases/case-overview-tab";
import { CaseCalendarSection } from "@/components/calendar/case-calendar-section";
import { loadCaseForWorkspace } from "./_load-case";
import { loadCaseLinkedProcesses } from "@/lib/cases/load-case-linked-processes";
import { Button } from "@/components/ui/button";
import { isCasePreProcessual } from "@/lib/cases/labels";

/**
 * P0 — Fluxo do caso reorganizado.
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/UX_FLOW_AUDIT.md
 */

export default async function CaseOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { workspaceId } = await getWorkspaceContext();
  const c = await loadCaseForWorkspace(workspaceId, id);
  if (!c) notFound();

  const legalProcesses = await loadCaseLinkedProcesses(workspaceId, id);
  const pre = isCasePreProcessual(c);
  const processHref = `/cases/${id}/processo`;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-[color:var(--border-default)] bg-[color:var(--surface-overlay-strong)] p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-caption font-semibold uppercase tracking-widest text-[color:var(--text-secondary)]">
                Processo judicial
              </p>
              <p className="mt-1 text-caption leading-snug text-muted-foreground">
                {legalProcesses.length > 0
                  ? `${legalProcesses.length} processo(s) vinculado(s).`
                  : pre
                    ? "Pré-processual · CNJ opcional."
                    : "Nenhum CNJ vinculado ainda."}
              </p>
            </div>
            <Button asChild size="sm" variant="outline" className="shrink-0">
              <Link href={processHref}>
                {legalProcesses.length > 0 ? "Ver processos" : "Vincular processo"}
              </Link>
            </Button>
          </div>
        </div>

        <CaseCalendarSection workspaceId={workspaceId} caseId={id} compact />
      </div>

      <CaseOverviewTab caseData={c} />
    </div>
  );
}
