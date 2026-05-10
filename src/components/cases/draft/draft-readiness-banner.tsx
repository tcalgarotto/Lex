/**
 * P0 — Estratégia e Peças (drafting + review + export).
 * Drafting-guard ativo; jurisprudência candidata não promovida sem confirmação humana.
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/features/CASE_DRAFTING_TAB.md
 */

"use client";

import { AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";

type Props = {
  missingCount: number;
  messages: string[];
};

export function DraftReadinessBanner({ missingCount, messages }: Props) {
  if (missingCount <= 0) return null;
  return (
    <Card className="flex gap-3 border-amber-500/40 bg-amber-950/30 p-4 text-amber-50">
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-300" />
      <div>
        <p className="font-medium text-amber-100">
          Faltam {missingCount} {missingCount === 1 ? "informação" : "informações"} antes de gerar a peça com confiança
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-amber-100/90">
          {messages.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
