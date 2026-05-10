"use client";

/**
 * P0 — Fluxo do caso reorganizado.
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/UX_FLOW_AUDIT.md
 *
 * Lazy-load da aba Estratégia e peças (Lane D). Import dinâmico para reduzir JS inicial.
 */

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const CaseDraftingTabDynamic = dynamic(
  () =>
    import("@/components/cases/strategy/case-drafting-tab").then((m) => ({
      default: m.CaseDraftingTab,
    })),
  {
    loading: () => (
      <div
        className="flex min-h-[12rem] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center text-sm text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
        <span>Carregando minuta…</span>
      </div>
    ),
  },
);

export function EstrategiaLazy({ caseId }: { caseId: string }) {
  return <CaseDraftingTabDynamic caseId={caseId} />;
}
