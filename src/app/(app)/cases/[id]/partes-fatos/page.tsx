import { notFound } from "next/navigation";
import { getWorkspaceContext } from "@/lib/auth/session";
import { CaseFactsPartiesTab } from "@/components/cases/case-facts-parties-tab";
import { loadCaseForWorkspace } from "../_load-case";

/**
 * P0 — Fluxo do caso reorganizado.
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/UX_FLOW_AUDIT.md
 */

export const dynamic = "force-dynamic";

export default async function CasePartiesFactsPage({
 params,
}: {
 params: Promise<{ id: string }>;
}) {
 const { id } = await params;
 const { workspaceId } = await getWorkspaceContext();
 const c = await loadCaseForWorkspace(workspaceId, id);
 if (!c) notFound();

 return (
 <div className="space-y-3">
 <header className="space-y-1">
 <h2 className="text-sm font-semibold text-foreground">Partes e fatos</h2>
 <p className="max-w-3xl text-sm text-muted-foreground">
 Fatos, partes, pedidos e riscos com edição inline. Cada item mantém origem e status para
 auditoria.
 </p>
 </header>
 <CaseFactsPartiesTab
 facts={c.facts}
 parties={c.parties}
 requests={c.requests}
 risks={c.risks}
 />
 </div>
 );
}
