/**
 * P0 — Estratégia e Peças (drafting + review + export).
 * Drafting-guard ativo; jurisprudência candidata não promovida sem confirmação humana.
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/features/CASE_DRAFTING_TAB.md
 */

"use client";

import { AlertTriangle, Gavel, Pin, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export type JurisRow = {
 id: string;
 court: string;
 title: string;
 processNumber?: string;
 verificationStatus: string;
 excerpt?: string;
};

type Props = {
 items: JurisRow[];
 onInsert: (snippet: string) => void;
};

export function StrategyJurisprudencePanel({ items, onInsert }: Props) {
 if (!items.length) {
 return (
 <Card className="p-3 text-sm text-muted-foreground">
 Nenhum julgado candidato vinculado a este caso ainda.
 </Card>
 );
 }

 return (
 <div className="space-y-2">
 {items.map((j) => {
 const unverified = j.verificationStatus === "AI_RECOMMENDED_UNVERIFIED";
 const missingProc = !j.processNumber?.trim();
 return (
 <Card
 key={j.id}
 className={`space-y-2 p-3 ${missingProc ? "border-amber-500/40 bg-amber-950/20" : ""}`}
 >
 <div className="flex flex-wrap items-start justify-between gap-2">
 <div className="flex items-start gap-2">
 <Gavel className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
 <div>
 <p className="text-sm font-medium leading-snug">{j.title}</p>
 <p className="text-xs text-muted-foreground">{j.court}</p>
 </div>
 </div>
 <Badge variant={unverified ? "secondary" : "default"}>
 {unverified ? "Candidato" : "Pin do workspace"}
 </Badge>
 </div>
 {missingProc ? (
 <div className="flex items-center gap-2 text-xs text-amber-200">
 <AlertTriangle className="size-3.5 shrink-0" />
 Sem número de processo informado — confira na fonte oficial antes de citar em peça.
 </div>
 ) : null}
 {j.excerpt ? (
 <p className="line-clamp-3 text-xs text-muted-foreground">{j.excerpt}</p>
 ) : null}
 <div className="flex flex-wrap gap-2">
 <Button
 type="button"
 size="sm"
 variant="secondary"
 onClick={() =>
 onInsert(
 `\n> **Julgado candidato** — ${j.title} (${j.court})${j.processNumber ? ` — proc. ${j.processNumber}` : ""} — confirmar fonte oficial antes de protocolar.\n`,
 )
 }
 >
 <Plus className="size-3.5" />
 Inserir no texto
 </Button>
 <Button
 type="button"
 size="sm"
 variant="outline"
 onClick={() => onInsert(` [julgado candidato ${j.id}]`)}
 >
 <Pin className="size-3.5" />
 Fixar como referência
 </Button>
 <Button type="button" size="sm" variant="ghost" disabled title="Use a pesquisa jurídica para ajustar a seleção">
 <Trash2 className="size-3.5" />
 Remover
 </Button>
 </div>
 </Card>
 );
 })}
 </div>
 );
}
