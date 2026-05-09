"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PenSquare, ShieldCheck, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ProceduralReadiness } from "@/lib/cases/brain-types";

interface CaseActionsProps {
  caseId: string;
  /**
   * F2.2 — Bloqueio de "Gerar peça" quando status === "insuficiente".
   * Lemos do `Case.metadataJson.brain.proceduralReadiness` no server e
   * passamos pra cá. `null` libera (sem bloqueio).
   */
  readiness?: ProceduralReadiness | null;
}

export function CaseActions({ caseId, readiness }: CaseActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<"draft" | "review" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [forceMode, setForceMode] = useState(false);

  const draftBlocked =
    readiness?.status === "insuficiente" && !forceMode;
  const blockedReason = readiness
    ? `Caso ainda insuficiente para gerar peça (score ${readiness.score}%). ${
        readiness.nextBestAction || "Complete os blockers críticos primeiro."
      }`
    : "";

  async function call(kind: "draft" | "review") {
    setLoading(kind);
    setErr(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/${kind}`, { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `falha ${res.status}`);
      }
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(null);
    }
  }

  const draftBtn = (
    <Button
      variant="outline"
      size="sm"
      onClick={() => call("draft")}
      disabled={loading !== null || draftBlocked}
      data-testid="case-draft-action"
    >
      {loading === "draft" ? (
        <Loader2 className="mr-1 size-3.5 animate-spin" />
      ) : draftBlocked ? (
        <AlertTriangle className="mr-1 size-3.5 text-amber-300" />
      ) : (
        <PenSquare className="mr-1 size-3.5" />
      )}
      Gerar peça
    </Button>
  );

  return (
    <TooltipProvider delayDuration={120}>
      <div className="flex flex-col items-end gap-1">
        <div className="flex flex-wrap gap-2">
          {draftBlocked ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span>{draftBtn}</span>
              </TooltipTrigger>
              <TooltipContent side="top">{blockedReason}</TooltipContent>
            </Tooltip>
          ) : (
            draftBtn
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => call("review")}
            disabled={loading !== null}
            data-testid="case-review-action"
          >
            {loading === "review" ? (
              <Loader2 className="mr-1 size-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="mr-1 size-3.5" />
            )}
            Revisar peça
          </Button>
        </div>
        {draftBlocked ? (
          <button
            type="button"
            onClick={() => setForceMode(true)}
            className="text-[11px] text-muted-foreground underline-offset-2 hover:underline"
          >
            Gerar mesmo assim (com lacunas explícitas)
          </button>
        ) : null}
        {err ? <span className="text-[11px] text-rose-300">{err}</span> : null}
      </div>
    </TooltipProvider>
  );
}
