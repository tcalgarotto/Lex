/**
 * P0 — Estratégia e Peças (drafting + review + export).
 * Drafting-guard ativo; jurisprudência candidata não promovida sem confirmação humana.
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/features/CASE_DRAFTING_TAB.md
 */

"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Readiness = {
 blockers?: string[];
 missingDocuments?: string[];
} | null;

type Props = {
 caseId: string;
 readiness: Readiness;
 draftingMessages: string[];
};

function tabHref(caseId: string, tab: string) {
 const path: Record<string, string> = {
 facts: "/partes-fatos",
 documents: "/documentos",
 research: "/pesquisa-juridica",
 strategy: "/estrategia",
 checklist: "/entrevista",
 };
 const suffix = path[tab];
 return suffix ? `/cases/${caseId}${suffix}` : `/cases/${caseId}`;
}

export function StrategyGapsPanel({ caseId, readiness, draftingMessages }: Props) {
 const blockers = readiness?.blockers ?? [];
 const missingDocs = readiness?.missingDocuments ?? [];
 const rows: { text: string; tab: string }[] = [];

 for (const b of blockers) {
 rows.push({ text: b, tab: "facts" });
 }
 for (const d of missingDocs) {
 rows.push({ text: d, tab: "documents" });
 }
 for (const m of draftingMessages) {
 if (m.includes("fundamento")) rows.push({ text: m, tab: "research" });
 else if (m.includes("fato")) rows.push({ text: m, tab: "facts" });
 else if (m.includes("autora") || m.includes("autor")) rows.push({ text: m, tab: "facts" });
 else if (m.includes("Julgado") || m.includes("julgado")) rows.push({ text: m, tab: "research" });
 else rows.push({ text: m, tab: "facts" });
 }

 if (rows.length === 0) {
 return (
 <Card className="p-3 text-sm text-muted-foreground">
 Nenhuma lacuna obrigatória listada para esta etapa.
 </Card>
 );
 }

 return (
 <div className="space-y-2">
 {rows.map((row, idx) => (
 <Card key={`${row.text}-${idx}`} className="flex items-start justify-between gap-2 p-3">
 <p className="text-sm leading-snug text-foreground">{row.text}</p>
 <Button type="button" size="sm" variant="outline" asChild className="shrink-0">
 <Link href={tabHref(caseId, row.tab)}>
 Resolver
 <ArrowRight className="ml-1 size-3" />
 </Link>
 </Button>
 </Card>
 ))}
 </div>
 );
}
