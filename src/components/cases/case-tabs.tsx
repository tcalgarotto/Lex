"use client";

/**
 * P0 — Fluxo do caso reorganizado (legado embutido).
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/UX_FLOW_AUDIT.md
 *
 * Preferir rotas por seção em `/cases/[id]/…`. Este componente permanece para referência
 * e possíveis telas de rollback até a Lane E consolidar testes.
 */

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import type {
 Case,
 CaseDraft,
 CaseFact,
 CaseLegalSource,
 CaseParty,
 CaseRequest,
 CaseReview,
 CaseRisk,
 CaseTimelineEvent,
 Document,
 Process,
} from "@prisma/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CaseOverviewTab } from "./case-overview-tab";
import { CaseDocumentsTab } from "./case-documents-tab";
import { CaseFactsPartiesTab } from "./case-facts-parties-tab";
import { CaseResearchTab } from "./case-research-tab";
import {
 CaseStrategyPiecesTab,
 type CaseStrategyView,
} from "./case-strategy-pieces-tab";
import { CaseTimelineTab } from "./case-timeline-tab";
import { CaseCollabTab } from "./case-collab-tab";
import { CaseChecklistTab } from "./case-checklist-tab";

type CaseFull = Case & {
 facts: CaseFact[];
 parties: CaseParty[];
 requests: CaseRequest[];
 risks: CaseRisk[];
 drafts: CaseDraft[];
 reviews: CaseReview[];
 timeline: CaseTimelineEvent[];
 legalSources: CaseLegalSource[];
 documents: Pick<
 Document,
 | "id"
 | "originalName"
 | "mimeType"
 | "status"
 | "progress"
 | "totalChunks"
 | "processedChunks"
 | "updatedAt"
 | "createdAt"
 | "processId"
 | "caseId"
 >[];
 process: Pick<Process, "id" | "number" | "title" | "tribunal" | "vara" | "tags"> | null;
};

export type CaseTabKey =
 | "overview"
 | "documents"
 | "facts"
 | "research"
 | "strategy"
 | "activity"
 | "checklist";

type TabKey = CaseTabKey;

function readStrategy(metadataJson: unknown): CaseStrategyView | null {
 if (!metadataJson || typeof metadataJson !== "object") return null;
 const m = metadataJson as { strategy?: unknown };
 const s = m.strategy;
 if (!s || typeof s !== "object") return null;
 const obj = s as Partial<CaseStrategyView>;
 if (typeof obj.thesis !== "string") return null;
 return {
 thesis: obj.thesis,
 arguments: Array.isArray(obj.arguments) ? obj.arguments : [],
 counterArguments: Array.isArray(obj.counterArguments) ? obj.counterArguments : [],
 nextSteps: Array.isArray(obj.nextSteps) ? obj.nextSteps : [],
 badge: obj.badge,
 generatedAt: obj.generatedAt,
 };
}

export function CaseTabs({
 caseData: c,
 initialTab,
}: {
 caseData: CaseFull;
 initialTab?: CaseTabKey;
}) {
 const router = useRouter();
 const [tab, setTab] = useState<TabKey>(() => initialTab ?? "overview");
 const strategy = readStrategy(c.metadataJson);

 const goTab = useCallback(
 (next: TabKey) => {
 setTab(next);
 router.replace(`/cases/${c.id}?tab=${next}`, { scroll: false });
 },
 [c.id, router],
 );

 return (
 <Tabs value={tab} onValueChange={(v) => goTab(v as TabKey)}>
 <TabsList className="flex w-full min-w-0 flex-wrap gap-1 overflow-x-auto pb-0.5">
 <TabsTrigger value="overview">Visão geral</TabsTrigger>
 <TabsTrigger value="documents">Documentos · {c.documents.length}</TabsTrigger>
 <TabsTrigger value="facts">
 Fatos &amp; Partes · {c.facts.length + c.parties.length}
 </TabsTrigger>
 <TabsTrigger value="research">
 Pesquisa jurídica · {c.legalSources.length}
 </TabsTrigger>
 <TabsTrigger value="strategy">
 Estratégia &amp; Peças · {c.drafts.length}
 </TabsTrigger>
 <TabsTrigger value="checklist">Entrevista guiada</TabsTrigger>
 <TabsTrigger value="activity">Atividade · {c.timeline.length}</TabsTrigger>
 </TabsList>

 <TabsContent value="overview" className="mt-4">
 <CaseOverviewTab caseData={c} />
 </TabsContent>
 <TabsContent value="documents" className="mt-4">
 <CaseDocumentsTab caseId={c.id} documents={c.documents} />
 </TabsContent>
 <TabsContent value="facts" className="mt-4">
 <CaseFactsPartiesTab
 facts={c.facts}
 parties={c.parties}
 requests={c.requests}
 risks={c.risks}
 />
 </TabsContent>
 <TabsContent value="research" className="mt-4">
 <CaseResearchTab caseId={c.id} legalSources={c.legalSources} caseRecord={c} />
 </TabsContent>
 <TabsContent value="strategy" className="mt-4">
 <CaseStrategyPiecesTab
 caseId={c.id}
 facts={c.facts}
 requests={c.requests}
 risks={c.risks}
 drafts={c.drafts}
 reviews={c.reviews}
 strategy={strategy}
 />
 </TabsContent>
 <TabsContent value="checklist" className="mt-4">
 <CaseChecklistTab caseId={c.id} />
 </TabsContent>
 <TabsContent value="activity" className="mt-4">
 <div className="space-y-6">
 <CaseTimelineTab events={c.timeline} />
 <CaseCollabTab caseId={c.id} />
 </div>
 </TabsContent>
 </Tabs>
 );
}
