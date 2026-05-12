import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getWorkspaceContext } from "@/lib/auth/session";
import { EstrategiaLazy } from "@/components/cases/estrategia-lazy";
import { loadCaseForWorkspace } from "../_load-case";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * P0 — Fluxo do caso reorganizado.
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/UX_FLOW_AUDIT.md
 */


function EstrategiaFallback() {
 return (
 <div
 className="space-y-3"
 role="status"
 aria-live="polite"
 aria-label="Carregando conteúdo da estratégia"
 >
 <Skeleton className="h-10 w-full max-w-md" />
 <Skeleton className="h-48 w-full" />
 </div>
 );
}

export default async function CaseStrategyPage({ params }: { params: Promise<{ id: string }> }) {
 const { id } = await params;
 const { workspaceId } = await getWorkspaceContext();
 const c = await loadCaseForWorkspace(workspaceId, id);
 if (!c) notFound();

 return (
 <div className="space-y-3">
 <header className="space-y-1">
 <h2 className="text-sm font-semibold text-foreground">Estratégia e peças</h2>
 <p className="max-w-3xl text-sm text-muted-foreground">
 Estratégia processual, minutas e revisões — mantidas na mesma linha do tempo do caso.
 </p>
 </header>
 <Suspense fallback={<EstrategiaFallback />}>
 <EstrategiaLazy caseId={c.id} />
 </Suspense>
 </div>
 );
}
