import { notFound } from "next/navigation";
import Link from "next/link";
import { getWorkspaceContext } from "@/lib/auth/session";
import { CaseOverviewTab } from "@/components/cases/case-overview-tab";
import { CaseCalendarSection } from "@/components/calendar/case-calendar-section";
import { loadCaseForWorkspace } from "./_load-case";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";

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

 return (
 <div className="space-y-4">
 <div className="space-y-2">
 <p className="text-micro font-semibold uppercase tracking-widest text-[color:var(--text-secondary)]">
 Visão geral
 </p>
 <p className="text-sm leading-relaxed text-[color:var(--text-secondary)]">
 Progresso do caso, narrativa consolidada, próximos passos, atividades e colaboração interna.
 </p>
 </div>
 <div className="rounded-xl border border-[color:var(--border-default)] bg-[color:var(--surface-overlay-strong)] p-4">
 <div className="flex flex-wrap items-center justify-between gap-3">
 <div>
 <p className="text-sm font-medium">Processo judicial vinculado</p>
 <p className="text-xs text-muted-foreground">Importe ou abra processos DataJud relacionados a este caso.</p>
 </div>
 <Button asChild size="sm" variant="outline">
 <Link href={`/processos?returnCase=${id}`}>Importar CNJ</Link>
 </Button>
 </div>
 {legalProcesses.length > 0 ? (
 <div className="mt-4 grid gap-2 md:grid-cols-2">
 {legalProcesses.map((process) => (
 <Link
 key={process.id}
 href={`/processos/${process.processId ?? process.id}`}
 className="rounded-lg border border-[color:var(--border-subtle)] p-3 text-sm hover:bg-[color:var(--surface-overlay)]"
 >
 <p className="font-medium">{process.cnjFormatted}</p>
 <p className="mt-1 text-xs text-muted-foreground">
 {process.tribunalAcronym} · {process.classeNome ?? "Classe não informada"} · {process._count.movements} movs. · {process._count.alerts} alertas
 </p>
 </Link>
 ))}
 </div>
 ) : (
 <p className="mt-3 text-sm text-muted-foreground">Nenhum processo DataJud vinculado ainda.</p>
 )}
 </div>
 <CaseCalendarSection workspaceId={workspaceId} caseId={id} />
 <CaseOverviewTab caseData={c} />
 </div>
 );
}
