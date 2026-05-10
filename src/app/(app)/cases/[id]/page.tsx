import { notFound } from "next/navigation";
import { getWorkspaceContext } from "@/lib/auth/session";
import { CaseOverviewTab } from "@/components/cases/case-overview-tab";
import { CaseTimelineTab } from "@/components/cases/case-timeline-tab";
import { CaseCollabTab } from "@/components/cases/case-collab-tab";
import { loadCaseForWorkspace } from "./_load-case";

/**
 * P0 — Fluxo do caso reorganizado.
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/UX_FLOW_AUDIT.md
 */

export const dynamic = "force-dynamic";

export default async function CaseOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { workspaceId } = await getWorkspaceContext();
  const c = await loadCaseForWorkspace(workspaceId, id);
  if (!c) notFound();

  return (
    <div className="space-y-8">
      <section aria-labelledby="case-overview-heading" className="space-y-2">
        <h2 id="case-overview-heading" className="text-sm font-semibold text-foreground">
          Visão geral
        </h2>
        <p className="text-sm text-muted-foreground">
          Progresso do caso, narrativa consolidada e próximos passos sugeridos.
        </p>
        <CaseOverviewTab caseData={c} />
      </section>

      <section aria-labelledby="case-activity-heading" className="space-y-2">
        <h2 id="case-activity-heading" className="text-sm font-semibold text-foreground">
          Atividades e colaboração
        </h2>
        <p className="text-sm text-muted-foreground">
          Linha do tempo auditável e comentários internos do time.
        </p>
        <div className="space-y-6">
          <CaseTimelineTab events={c.timeline} />
          <CaseCollabTab caseId={c.id} />
        </div>
      </section>
    </div>
  );
}
