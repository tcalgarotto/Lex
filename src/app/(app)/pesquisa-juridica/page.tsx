"use client";

import { Suspense } from "react";
import { AppShell } from "@/components/app/app-shell";
import { LegalSearchPanel } from "@/components/legal-search/legal-search-panel";

export default function PesquisaJuridicaPage() {
  return (
    <AppShell title="Pesquisa jurídica">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold">Pesquisa jurídica</h1>
          <p className="text-sm text-muted-foreground">
            Pesquise legislação, fundamentos e documentos do escritório. Quando
            estiver dentro de um caso, marque os fundamentos relevantes com
            <span className="mx-1 rounded bg-violet-500/10 px-1 text-violet-200">
              Usar no caso
            </span>
            para alimentar a estratégia.
          </p>
        </header>

        <Suspense fallback={<div className="text-sm text-muted-foreground">Carregando…</div>}>
          <LegalSearchPanel />
        </Suspense>
      </div>
    </AppShell>
  );
}
