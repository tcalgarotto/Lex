import { notFound } from "next/navigation";
import { getWorkspaceContext } from "@/lib/auth/session";
import { CaseChecklistTab } from "@/components/cases/case-checklist-tab";
import { loadCaseForWorkspace } from "../_load-case";

/**
 * P0 — Fluxo do caso reorganizado.
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/UX_FLOW_AUDIT.md
 */


export default async function CaseInterviewPage({ params }: { params: Promise<{ id: string }> }) {
 const { id } = await params;
 const { workspaceId } = await getWorkspaceContext();
 const c = await loadCaseForWorkspace(workspaceId, id);
 if (!c) notFound();

 return (
 <div className="space-y-3">
 <header className="space-y-1">
 <h2 className="text-sm font-semibold text-foreground">Entrevista guiada</h2>
 <p className="max-w-3xl text-sm text-muted-foreground">
 Responda por seções; as respostas alimentam a inteligência do caso e aparecem em Partes e
 fatos com origem rastreável.
 </p>
 </header>
 <CaseChecklistTab caseId={c.id} />
 </div>
 );
}
