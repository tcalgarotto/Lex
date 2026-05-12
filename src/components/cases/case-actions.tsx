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
 readiness.nextBestAction || "Complete as pendências críticas primeiro."
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
 className="border-[0.5px] border-[color:var(--border-default)] bg-[color:var(--surface-overlay)] text-[color:var(--text-primary)] hover:bg-[color:var(--surface-overlay-strong)]"
 >
 {loading === "draft" ? (
 <Loader2 className="mr-1 size-3.5 animate-spin" />
 ) : draftBlocked ? (
 <AlertTriangle className="mr-1 size-3.5 text-[color:var(--warning-text)]" />
 ) : (
 <PenSquare className="mr-1 size-3.5" />
 )}
 Gerar peça
 <kbd className="lex-kbd ml-1.5 hidden sm:inline">⌘G</kbd>
 </Button>
 );

 return (
 <TooltipProvider delayDuration={120}>
 <div className="flex shrink-0 flex-col items-stretch gap-1 sm:items-end">
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
 size="sm"
 onClick={() => call("review")}
 disabled={loading !== null}
 data-testid="case-review-action"
 className="border-[0.5px] border-[color:var(--brand-border)] text-[color:var(--text-inverse)] lex-transition hover:opacity-95"
 style={{
 background: "var(--brand-primary)",
 boxShadow: "var(--shadow-violet)",
 }}
 >
 {loading === "review" ? (
 <Loader2 className="mr-1 size-3.5 animate-spin" />
 ) : (
 <ShieldCheck className="mr-1 size-3.5" />
 )}
 Revisar peça
 <kbd className="lex-kbd ml-1.5 hidden sm:inline">⌘R</kbd>
 </Button>
 </div>
 {draftBlocked ? (
 <button
 type="button"
 onClick={() => setForceMode(true)}
 className="text-left text-[11px] text-[color:var(--text-muted)] underline-offset-2 hover:underline sm:text-right"
 >
 Gerar mesmo assim (com lacunas explícitas)
 </button>
 ) : null}
 {err ? (
 <span className="text-[11px] text-[color:var(--danger-text)]">{err}</span>
 ) : null}
 </div>
 </TooltipProvider>
 );
}
