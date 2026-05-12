/**
 * P0 — Fluxo do caso reorganizado.
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/UX_FLOW_AUDIT.md
 */

import { Suspense } from "react";
import { AppShell } from "@/components/app/app-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { GlobalPesquisaWorkbench } from "@/components/cases/global-pesquisa-workbench";

function PesquisaFallback() {
 return (
 <div className="space-y-4" aria-live="polite">
 <Skeleton className="h-24 w-full rounded-lg" />
 <Skeleton className="h-12 w-full max-w-2xl rounded-lg" />
 <Skeleton className="h-64 w-full rounded-lg" />
 </div>
 );
}

export default function PesquisaJuridicaPage() {
 return (
 <AppShell title="Pesquisa jurídica">
 <div className="mx-auto max-w-6xl space-y-6">
 <header className="space-y-2 rounded-xl border border-border bg-card/60 p-6 shadow-sm">
 <h1 className="text-2xl font-semibold tracking-tight text-foreground">Pesquisa jurídica</h1>
 <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
 Busque fundamentos, jurisprudência e linhas de estratégia com assistência controlada. Os
 resultados devem ser validados antes de constar em petição ou parecer.
 </p>
 </header>

 <Suspense fallback={<PesquisaFallback />}>
 <GlobalPesquisaWorkbench />
 </Suspense>
 </div>
 </AppShell>
 );
}
