import { notFound } from "next/navigation";
import { getWorkspaceContext } from "@/lib/auth/session";
import { CaseOverviewTab } from "@/components/cases/case-overview-tab";
import { loadCaseForWorkspace } from "./_load-case";

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

 return (
 <div className="space-y-2">
 <p className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--text-muted)]">
 Visão geral
 </p>
 <p className="text-[13px] leading-relaxed text-[color:var(--text-secondary)]">
 Progresso do caso, narrativa consolidada, próximos passos, atividades e colaboração interna.
 </p>
 <CaseOverviewTab caseData={c} />
 </div>
 );
}
