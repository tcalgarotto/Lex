import { notFound } from "next/navigation";
import Link from "next/link";
import { getWorkspaceContext } from "@/lib/auth/session";
import { CaseOverviewTab } from "@/components/cases/case-overview-tab";
import { CaseCalendarSection } from "@/components/calendar/case-calendar-section";
import { loadCaseForWorkspace } from "./_load-case";
import { prisma } from "@/lib/prisma";
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
  const legalProcesses = await prisma.legalProcess.findMany({
    where: { workspaceId, caseId: id },
    orderBy: { updatedAt: "desc" },
    take: 5,
    select: {
      id: true,
      processId: true,
      cnjFormatted: true,
      tribunalAcronym: true,
      classeNome: true,
      dataJudStatus: true,
      _count: { select: { movements: true, alerts: true } },
    },
  });

  const pre = isCasePreProcessual(c);

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
                {pre && legalProcesses.length === 0
                  ? "Pré-processual · sem CNJ."
                  : "CNJ vinculado a este caso."}
              </p>
            </div>
            <Button asChild size="sm" variant="outline" className="shrink-0">
              <Link href={`/processos?returnCase=${id}`}>Importar CNJ</Link>
            </Button>
          </div>
          {legalProcesses.length > 0 ? (
            <div className="mt-2 grid gap-2 sm:grid-cols-1">
              {legalProcesses.map((process) => (
                <Link
                  key={process.id}
                  href={`/processos/${process.processId ?? process.id}`}
                  className="rounded-lg border border-[color:var(--border-subtle)] p-2 text-sm hover:bg-[color:var(--surface-overlay)]"
                >
                  <p className="font-medium">{process.cnjFormatted}</p>
                  <p className="mt-0.5 text-caption text-muted-foreground">
                    {process.tribunalAcronym} · {process.classeNome ?? "Classe não informada"}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-caption text-muted-foreground">Nenhum CNJ vinculado.</p>
          )}
        </div>

        <CaseCalendarSection workspaceId={workspaceId} caseId={id} compact />
      </div>

      <CaseOverviewTab caseData={c} />
    </div>
  );
}
