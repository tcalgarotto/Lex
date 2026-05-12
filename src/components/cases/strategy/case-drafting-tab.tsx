/**
 * P0 — Estratégia e Peças (drafting + review + export).
 * Drafting-guard ativo; jurisprudência candidata não promovida sem confirmação humana.
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/features/CASE_DRAFTING_TAB.md
 *
 * Layout de referência: três colunas (etapas | editor largura papel ~720px | painel contextual).
 * Padrões extraídos de `docs/model design/preview(1).html` (hierarquia, densidade, cartões) sem copiar classes ou marca.
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { DraftEditor } from "@/components/cases/draft/draft-editor";
import { DraftActionsBar } from "@/components/cases/draft/draft-actions-bar";
import { DraftReadinessBanner } from "@/components/cases/draft/draft-readiness-banner";
import { StrategyStepper } from "@/components/cases/strategy/strategy-stepper";
import { StrategyGapsPanel } from "@/components/cases/strategy/strategy-gaps-panel";
import { StrategyFoundationsPanel } from "@/components/cases/strategy/strategy-foundations-panel";
import {
 StrategyJurisprudencePanel,
 type JurisRow,
} from "@/components/cases/strategy/strategy-jurisprudence-panel";
import { previewDraftingGuardMessages } from "@/lib/cases/drafting/drafting-guard";

type CaseApi = {
 parties: { role: string }[];
 facts: { id: string }[];
};

type StrategyBundle = {
 readiness: { score?: number; blockers?: string[]; missingDocuments?: string[] } | null;
 draftingStrategy: unknown;
 approved: boolean;
 jurisprudenceCandidates: JurisRow[];
};

export function CaseDraftingTab({ caseId }: { caseId: string }) {
 const [activeStep, setActiveStep] = useState(4);
 const [bundle, setBundle] = useState<StrategyBundle | null>(null);
 const [caseData, setCaseData] = useState<CaseApi | null>(null);
 const [draftId, setDraftId] = useState<string | null>(null);
 const [content, setContent] = useState("");
 const [pinsCount, setPinsCount] = useState(0);
 const [confirmUnverified, setConfirmUnverified] = useState(false);
 const draftIdRef = useRef<string | null>(null);
 draftIdRef.current = draftId;

 const refresh = useCallback(async () => {
 const [sRes, cRes, dRes, lRes] = await Promise.all([
 fetch(`/api/cases/${caseId}/strategy`),
 fetch(`/api/cases/${caseId}`),
 fetch(`/api/cases/${caseId}/drafts`),
 fetch(`/api/cases/${caseId}/legal-sources`),
 ]);
 const sJson = await sRes.json();
 const cJson = await cRes.json();
 const dJson = await dRes.json();
 const lJson = await lRes.json();
 if (sRes.ok) {
 setBundle({
 readiness: sJson.readiness ?? null,
 draftingStrategy: sJson.draftingStrategy ?? null,
 approved: Boolean(sJson.approved),
 jurisprudenceCandidates: (sJson.jurisprudenceCandidates ?? []) as JurisRow[],
 });
 }
 if (cRes.ok) setCaseData(cJson.case as CaseApi);
 if (lRes.ok) setPinsCount((lJson.sources as unknown[])?.length ?? 0);
 if (dRes.ok) {
 const drafts = dJson.drafts as { id: string; content: string; version: number }[];
 let nextId = draftIdRef.current;
 if (!nextId || !drafts.some((d) => d.id === nextId)) {
 nextId = drafts[0]?.id ?? null;
 }
 setDraftId(nextId);
 const current = drafts.find((d) => d.id === nextId);
 if (current) setContent(current.content);
 }
 }, [caseId]);

 useEffect(() => {
 void refresh();
 }, [refresh]);

 const readinessPct = bundle?.readiness && typeof bundle.readiness.score === "number"
 ? bundle.readiness.score
 : 0;

 const hasAuthor = useMemo(() => {
 if (!caseData) return false;
 return caseData.parties.some((p) => p.role === "AUTHOR");
 }, [caseData]);

 const hasFact = (caseData?.facts.length ?? 0) > 0;

 const hasUnverifiedJuris = useMemo(
 () => bundle?.jurisprudenceCandidates?.some((j) => j.verificationStatus === "AI_RECOMMENDED_UNVERIFIED") ?? false,
 [bundle],
 );

 const draftingMessages = previewDraftingGuardMessages({
 hasAuthor,
 hasFact,
 pinCount: pinsCount,
 hasUnverifiedFoundation: false,
 hasUnverifiedJuris,
 confirmUnverified,
 });

 const bannerMessages = [
 ...new Set([
 ...draftingMessages,
 ...(bundle?.readiness?.blockers ?? []),
 ...(bundle?.readiness?.missingDocuments ?? []),
 ]),
 ];
 const gapCount = bannerMessages.length;

 const insertSnippet = (snippet: string) => {
 setContent((c) => `${c}${snippet}`);
 };

 async function approveStrategy() {
 try {
 const res = await fetch(`/api/cases/${caseId}/strategy/approve`, { method: "POST" });
 const data = await res.json();
 if (!res.ok) throw new Error(data.error ?? "Falha ao aprovar");
 toast.success("Estratégia aprovada para orientar as peças.");
 await refresh();
 } catch (e) {
 toast.error(e instanceof Error ? e.message : String(e));
 }
 }

 return (
 <div className="space-y-4">
 <DraftReadinessBanner missingCount={gapCount} messages={bannerMessages} />

 <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,720px)_minmax(260px,1fr)] lg:items-start">
 <Card className="p-4">
 <StrategyStepper activeIndex={activeStep} readinessPercent={readinessPct} />
 <Separator className="my-4" />
 <p className="text-[11px] text-muted-foreground">
 Ajuste o passo conforme o fluxo interno do caso. A prontidão vem dos dados consolidados.
 </p>
 <div className="mt-3 flex flex-wrap gap-1">
 {[0, 1, 2, 3, 4, 5].map((i) => (
 <Button key={i} type="button" size="sm" variant={activeStep === i ? "default" : "outline"} onClick={() => setActiveStep(i)}>
 {i + 1}
 </Button>
 ))}
 </div>
 </Card>

 <div className="mx-auto w-full max-w-[720px] space-y-2">
 <Card className="overflow-hidden shadow-md">
 <div className="border-b border-border bg-muted/30 px-3 py-2">
 <p className="text-xs font-medium text-muted-foreground">Editor central · Markdown</p>
 </div>
 <DraftEditor value={content} onChange={setContent} />
 <DraftActionsBar
 caseId={caseId}
 draftId={draftId}
 content={content}
 confirmUnverified={confirmUnverified}
 onRefresh={refresh}
 onDraftIdChange={(id) => setDraftId(id)}
 />
 </Card>
 </div>

 <Card className="p-3">
 <Tabs defaultValue="ia">
 <TabsList className="grid w-full grid-cols-2 gap-1 lg:grid-cols-4">
 <TabsTrigger value="ia">IA</TabsTrigger>
 <TabsTrigger value="lacunas">Lacunas</TabsTrigger>
 <TabsTrigger value="fund">Fundamentos</TabsTrigger>
 <TabsTrigger value="juris">Julgados</TabsTrigger>
 </TabsList>
 <TabsContent value="ia" className="mt-3 space-y-3 text-sm">
 <p className="text-muted-foreground">
 Gere a estratégia assistida com base nos dados confirmados e nos pins. Aprove quando fizer sentido
 jurídico.
 </p>
 {bundle?.draftingStrategy && typeof bundle.draftingStrategy === "object" ? (
 <pre className="max-h-64 overflow-auto rounded-md bg-muted/40 p-2 text-[11px] leading-relaxed">
 {JSON.stringify(bundle.draftingStrategy, null, 2)}
 </pre>
 ) : (
 <p className="text-xs text-muted-foreground">Nenhuma estratégia assistida salva ainda.</p>
 )}
 <div className="flex flex-wrap gap-2">
 <Button type="button" size="sm" variant="secondary" onClick={() => void refresh()}>
 Atualizar painel
 </Button>
 <Button type="button" size="sm" disabled={!bundle?.draftingStrategy || bundle.approved} onClick={approveStrategy}>
 Aprovar estratégia
 </Button>
 </div>
 <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
 <input
 type="checkbox"
 className="size-4 rounded border border-input"
 checked={confirmUnverified}
 onChange={(e) => setConfirmUnverified(e.target.checked)}
 />
 Confirmo o uso de julgados ainda indicados automaticamente, sem tratar como decisão verificada.
 </label>
 </TabsContent>
 <TabsContent value="lacunas" className="mt-3">
 <StrategyGapsPanel caseId={caseId} readiness={bundle?.readiness ?? null} draftingMessages={bannerMessages} />
 </TabsContent>
 <TabsContent value="fund" className="mt-3">
 <StrategyFoundationsPanel caseId={caseId} onInsert={insertSnippet} onChanged={refresh} />
 </TabsContent>
 <TabsContent value="juris" className="mt-3">
 <StrategyJurisprudencePanel items={bundle?.jurisprudenceCandidates ?? []} onInsert={insertSnippet} />
 </TabsContent>
 </Tabs>
 </Card>
 </div>
 </div>
 );
}
