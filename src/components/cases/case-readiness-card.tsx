"use client";

/**
 * F2.2 — Cartão "Prontidão processual".
 *
 * Lê `Case.metadataJson.brain.proceduralReadiness` (calculado por
 * `computeProceduralReadiness`). Mostra:
 * - score com cor por status
 * - status PT-BR
 * - blockers (com setinha CTA quando faz sentido)
 * - próxima melhor ação
 * - rationale colapsável
 */

import { useState } from "react";
import { ChevronDown, AlertCircle, CheckCircle2, Activity, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ProceduralReadiness, ProceduralReadinessStatus } from "@/lib/cases/brain-types";

const STATUS_LABEL: Record<ProceduralReadinessStatus, string> = {
 insuficiente: "Insuficiente",
 parcial: "Parcial",
 boa: "Boa",
 pronta_para_minuta: "Pronta para minuta",
};

const STATUS_TONE: Record<
 ProceduralReadinessStatus,
 { bar: string; text: string; ring: string; cardBorder: string; icon: React.ReactNode }
> = {
 insuficiente: {
 bar: "bg-rose-500",
 text: "text-rose-200",
 ring: "ring-rose-500/30",
 cardBorder: "border-rose-500/30",
 icon: <AlertCircle className="size-4 text-rose-300" />,
 },
 parcial: {
 bar: "bg-amber-500",
 text: "text-amber-200",
 ring: "ring-amber-500/30",
 cardBorder: "border-amber-500/30",
 icon: <Activity className="size-4 text-amber-300" />,
 },
 boa: {
 bar: "bg-lime-500",
 text: "text-lime-200",
 ring: "ring-lime-500/30",
 cardBorder: "border-lime-500/20",
 icon: <CheckCircle2 className="size-4 text-lime-300" />,
 },
 pronta_para_minuta: {
 bar: "bg-emerald-500",
 text: "text-emerald-200",
 ring: "ring-emerald-500/30",
 cardBorder: "border-emerald-500/30",
 icon: <Sparkles className="size-4 text-emerald-300" />,
 },
};

export function ReadinessCard({ readiness }: { readiness: ProceduralReadiness }) {
 const [openRationale, setOpenRationale] = useState(false);
 const tone = STATUS_TONE[readiness.status];
 const score = Math.max(0, Math.min(100, Math.round(readiness.score)));

 return (
 <Card className={`p-4 ${tone.cardBorder}`}>
 <div className="flex flex-wrap items-start justify-between gap-3">
 <div>
 <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
 Prontidão processual
 </p>
 <div className="mt-1 flex items-baseline gap-2">
 <span className={`text-2xl font-semibold ${tone.text}`}>{score}%</span>
 <Badge variant="outline" className={`uppercase tracking-wide ${tone.text}`}>
 {tone.icon}
 <span className="ml-1">{STATUS_LABEL[readiness.status]}</span>
 </Badge>
 </div>
 </div>

 <div className="min-w-[160px] flex-1 max-w-[260px]">
 <div className="h-2 w-full overflow-hidden rounded bg-[color:var(--surface-card)] ring-1 ring-inset">
 <div
 className={`h-full transition-all ${tone.bar}`}
 style={{ width: `${score}%` }}
 aria-label="barra de prontidão"
 />
 </div>
 </div>
 </div>

 {readiness.nextBestAction ? (
 <div className="mt-3 rounded border border-[color:var(--border-default)] bg-white/[0.02] p-3">
 <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
 Próxima melhor ação
 </p>
 <p className="mt-1 text-sm leading-relaxed">{readiness.nextBestAction}</p>
 </div>
 ) : null}

 {readiness.blockers.length > 0 ? (
 <div className="mt-3">
 <p className="text-[10px] uppercase tracking-wide text-rose-200">
 Pendências críticas ({readiness.blockers.length})
 </p>
 <ul className="mt-1 space-y-0.5 text-xs">
 {readiness.blockers.map((b) => (
 <li key={b} className="text-rose-100/90">
 • {b}
 </li>
 ))}
 </ul>
 </div>
 ) : null}

 {readiness.missingDocuments.length > 0 ? (
 <div className="mt-3">
 <p className="text-[10px] uppercase tracking-wide text-amber-200">
 Documentos a solicitar ({readiness.missingDocuments.length})
 </p>
 <ul className="mt-1 space-y-0.5 text-xs">
 {readiness.missingDocuments.slice(0, 6).map((d) => (
 <li key={d} className="text-amber-100/90">
 • {d}
 </li>
 ))}
 {readiness.missingDocuments.length > 6 ? (
 <li className="text-amber-100/60">
 + {readiness.missingDocuments.length - 6} item(s)…
 </li>
 ) : null}
 </ul>
 </div>
 ) : null}

 <button
 type="button"
 onClick={() => setOpenRationale((p) => !p)}
 className="mt-3 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground/80"
 >
 Por que esse score?{" "}
 <ChevronDown
 className={`size-3 transition-transform ${openRationale ? "rotate-180" : ""}`}
 />
 </button>
 {openRationale ? (
 <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
 {readiness.rationale}
 </p>
 ) : null}
 </Card>
 );
}
