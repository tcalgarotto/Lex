"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { GitBranch, Loader2, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GroundingPanel } from "@/components/retrieval/grounding-panel";
import { LegalTimelineList } from "@/components/retrieval/legal-timeline";
import { IssuesList } from "@/components/retrieval/issues-list";
import { ReasoningTreePanel } from "@/components/strategy/reasoning-tree-panel";
import { PrecedentMap } from "@/components/strategy/precedent-map";
import { StrategicDashboard } from "@/components/strategy/strategic-dashboard";
import { LawyerBrainCard } from "@/components/strategy/lawyer-brain-card";
import { ConfidenceMeter } from "@/components/trust/confidence-meter";
import { DivergenceIndicator } from "@/components/trust/divergence-indicator";
import { ForceBar } from "@/components/trust/force-bar";
import { GroundingHeatmap } from "@/components/trust/grounding-heatmap";
import { ReasoningMap } from "@/components/trust/reasoning-map";
import type { ReasoningTreeNode } from "@/lib/legal/reasoning/explain-tree";
import type { StrategicLegalAssessment } from "@/lib/legal/reasoning/strategic";
import type { LegalRetrievalResult } from "@/lib/retrieval/legal/types";
import type { ResearchEngineReport } from "@/lib/research/types";
import type { LegalIssue } from "@/lib/legal/reasoning/issue-spotting";
import type { ContradictionRisk } from "@/lib/legal/reasoning/contradiction";
import type { StrategySynthesis } from "@/lib/legal/reasoning/strategy";
import type { NormTimeline } from "@/lib/legal/reasoning/timeline";

type AnalyzePayload = {
 retrieval: LegalRetrievalResult;
 reasoning: {
 issues: LegalIssue[];
 risks: ContradictionRisk[];
 timelines: NormTimeline[];
 strategy: StrategySynthesis;
 };
 research: ResearchEngineReport;
 strategic: StrategicLegalAssessment;
 explainability: {
 reasoningTree: ReasoningTreeNode;
 timelineIntelligence: NormTimeline[];
 };
 lawyerBrain: unknown;
 officeMemory: Array<{ id: string; kind: string; title: string | null; content: string }>;
 winningSamplesCount: number;
};

type BrainPayload = {
 lawyerBrain: unknown;
 winningSamples: Array<{ id: string; title: string }>;
 styleMemory: Array<{ id: string; title: string | null }>;
};

export default function StrategyPage() {
 const [q, setQ] = useState("boa-fé objetiva CDC art. 422 contratos");
 const [tribunals, setTribunals] = useState("");
 const [uf, setUf] = useState("");
 const [caseId, setCaseId] = useState("");
 const [loading, setLoading] = useState(false);
 const [data, setData] = useState<AnalyzePayload | null>(null);
 const [error, setError] = useState<string | null>(null);
 const [brain, setBrain] = useState<BrainPayload | null>(null);

 const loadBrain = useCallback(async () => {
 const res = await fetch("/api/lawyer-brain");
 if (!res.ok) return;
 const j = (await res.json()) as BrainPayload;
 setBrain(j);
 }, []);

 useEffect(() => {
 void loadBrain();
 }, [loadBrain]);

 const run = useCallback(async () => {
 if (q.trim().length < 2) return;
 setLoading(true);
 setError(null);
 try {
 const sp = new URLSearchParams({ q: q.trim() });
 if (tribunals.trim()) sp.set("tribunals", tribunals.trim());
 if (uf.trim()) sp.set("uf", uf.trim());
 if (caseId.trim()) sp.set("caseId", caseId.trim());
 const res = await fetch(`/api/strategy/analyze?${sp.toString()}`);
 if (!res.ok) {
 const b = (await res.json().catch(() => ({}))) as { error?: string };
 throw new Error(b.error ?? `falha ${res.status}`);
 }
 setData((await res.json()) as AnalyzePayload);
 } catch (e) {
 setError((e as Error).message);
 } finally {
 setLoading(false);
 }
 }, [q, tribunals, uf, caseId]);

 return (
 <AppShell title="Estratégia jurídica">
 <div className="mx-auto max-w-6xl space-y-6">
 <header className="space-y-2">
 <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
 <GitBranch className="size-3.5" /> Plataforma de estratégia auditável
 </div>
 <h1 className="text-2xl font-semibold">Copiloto estratégico</h1>
 <p className="max-w-3xl text-sm text-muted-foreground">
 Research Engine (teses, divergências, precedentes líderes), raciocínio estratégico determinístico,
 fingerprints do escritório e visualizações premium — tudo rastreável, multi-tenant e sem agente autônomo.
 </p>
 </header>

 <LawyerBrainCard initial={brain} onRefresh={loadBrain} />

 <div className="rounded-xl border border-[color:var(--border-default)] bg-[color:var(--surface-overlay-strong)] p-4 space-y-3">
 <div className="grid gap-2 md:grid-cols-2">
 <Input
 value={q}
 onChange={(e) => setQ(e.target.value)}
 placeholder="Consulta jurídica…"
 className="font-mono text-sm md:col-span-2"
 data-testid="strategy-query"
 />
 <Input
 value={tribunals}
 onChange={(e) => setTribunals(e.target.value)}
 placeholder="Tribunais (ex.: TJSP,STF)"
 className="font-mono text-xs"
 />
 <Input value={uf} onChange={(e) => setUf(e.target.value)} placeholder="UF (ex.: SP)" maxLength={2} className="font-mono text-xs uppercase" />
 <Input
 value={caseId}
 onChange={(e) => setCaseId(e.target.value)}
 placeholder="Case ID (opcional — lacunas com fatos do caso)"
 className="font-mono text-xs md:col-span-2"
 />
 </div>
 <Button onClick={run} disabled={loading} data-testid="strategy-run">
 {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Sparkles className="mr-2 size-4" />}
 Executar análise estratégica
 </Button>
 {error ? <p className="text-sm text-rose-300">{error}</p> : null}
 </div>

 {loading && (
 <div className="flex items-center gap-2 text-sm text-muted-foreground">
 <Loader2 className="size-4 animate-spin" /> Processando pipeline completo…
 </div>
 )}

 {data && (
 <TrustUxOverview data={data} />
 )}

 {data && (
 <Tabs defaultValue="research">
 <TabsList className="flex flex-wrap gap-1">
 <TabsTrigger value="research">Research Engine</TabsTrigger>
 <TabsTrigger value="strategic">Raciocínio</TabsTrigger>
 <TabsTrigger value="explain">Explainability</TabsTrigger>
 <TabsTrigger value="sources">Fontes & tempo</TabsTrigger>
 </TabsList>

 <TabsContent value="research" className="mt-4 space-y-4">
 <GroundingPanel
 score={data.retrieval.confidence.score}
 label={data.retrieval.confidence.label}
 reason={data.retrieval.confidence.reason}
 candidates={data.retrieval.trace.candidates}
 />
 <CardSection title="Entendimento consolidado">
 <p className="text-sm font-medium text-foreground">{data.research.consolidated.headline}</p>
 <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
 {data.research.consolidated.paragraphs.map((p, i) => (
 <li key={i}>{p}</li>
 ))}
 </ul>
 </CardSection>
 <div className="grid gap-4 lg:grid-cols-2">
 <CardSection title="Teses dominantes (agrupamento por âncora normativa)">
 <ul className="space-y-2 text-xs">
 {data.research.thesisGroups.slice(0, 8).map((t) => (
 <li key={t.id} className="rounded-md border border-[color:var(--border-default)] p-2">
 <span className="font-mono text-[10px] text-indigo-300">{t.anchorUrn}</span>
 <p className="mt-1 text-foreground">{t.identifier ?? t.title}</p>
 <p className="text-muted-foreground">
 score dominante {t.dominantScore.toFixed(3)} · {t.chunkIds.length} trechos
 </p>
 </li>
 ))}
 </ul>
 </CardSection>
 <CardSection title="Divergências jurisprudenciais">
 <ul className="space-y-2 text-xs">
 {data.research.divergences.length === 0 ? (
 <li className="text-muted-foreground">Nenhum sinal automático de divergência.</li>
 ) : (
 data.research.divergences.map((d) => (
 <li key={d.id} className="rounded-md border border-amber-500/20 bg-amber-500/5 p-2">
 <BadgeSeverity sev={d.severity} /> {d.summary}
 <p className="mt-1 text-muted-foreground">{d.detail.slice(0, 220)}</p>
 </li>
 ))
 )}
 </ul>
 </CardSection>
 </div>
 <PrecedentMap leaders={data.research.leadingPrecedents} groups={data.research.thesisGroups} />
 </TabsContent>

 <TabsContent value="strategic" className="mt-4">
 <StrategicDashboard data={data.strategic} />
 <div className="mt-4 rounded-xl border border-[color:var(--border-default)] p-4">
 <h3 className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Heurísticas de risco</h3>
 <ul className="space-y-2 text-xs">
 {data.strategic.riskHeuristics.map((r) => (
 <li key={r.id} className="flex flex-col rounded-md bg-white/5 p-2">
 <span className="font-medium">{r.label}</span>
 <span className="text-muted-foreground">{r.hint}</span>
 </li>
 ))}
 </ul>
 </div>
 </TabsContent>

 <TabsContent value="explain" className="mt-4 grid gap-4 lg:grid-cols-2">
 <ReasoningTreePanel root={data.explainability.reasoningTree} />
 <IssuesList issues={data.reasoning.issues} />
 <div className="lg:col-span-2">
 <CardSection title="Pontes para estratégia (auditável)">
 <ol className="list-decimal space-y-1 pl-5 text-xs">
 {data.strategic.strategyBridge.map((s, i) => (
 <li key={i}>{s}</li>
 ))}
 </ol>
 </CardSection>
 </div>
 </TabsContent>

 <TabsContent value="sources" className="mt-4 space-y-4">
 <LegalTimelineList timelines={data.explainability.timelineIntelligence} />
 <CardSection title="Memória do escritório (amostra)">
 <ul className="space-y-1 text-[11px] text-muted-foreground">
 {data.officeMemory.slice(0, 6).map((m) => (
 <li key={m.id}>
 <span className="font-mono text-indigo-300">{m.kind}</span> — {m.title ?? m.content.slice(0, 80)}
 </li>
 ))}
 </ul>
 </CardSection>
 </TabsContent>
 </Tabs>
 )}
 </div>
 </AppShell>
 );
}

function CardSection({ title, children }: { title: string; children: ReactNode }) {
 return (
 <section className="rounded-xl border border-[color:var(--border-default)] bg-[color:var(--surface-overlay-strong)] p-4">
 <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
 {children}
 </section>
 );
}

function BadgeSeverity({ sev }: { sev: string }) {
 const tone =
 sev === "alta" ? "border-rose-500/40 text-rose-300" : sev === "media" ? "border-amber-500/40 text-amber-300" : "border-[color:var(--border-strong)] text-[color:var(--text-secondary)]";
 return (
 <span className={`mr-2 rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase ${tone}`}>{sev}</span>
 );
}

function TrustUxOverview({ data }: { data: AnalyzePayload }) {
 const top = data.retrieval.chunks.slice(0, 24).map((c) => ({
 chunkId: c.chunkId,
 score: c.scores.rerank ?? c.scores.rrf ?? c.scores.dense ?? c.scores.bm25 ?? 0,
 reference: c.norm.urn,
 label: c.fullPath ?? c.norm.title,
 }));
 const divergencesCount = data.research.divergences.length;
 const divergenceLevel: "none" | "low" | "medium" | "high" =
 divergencesCount === 0
 ? "none"
 : divergencesCount === 1
 ? "low"
 : divergencesCount <= 3
 ? "medium"
 : "high";
 const argScore = data.strategic.tribunalFavorability.alignmentScore;
 const reasoningSteps = [
 {
 id: "intent",
 label: `Intent: ${data.retrieval.intent.classification}`,
 tone: "info" as const,
 },
 {
 id: "retrieval",
 label: "Retrieval",
 count: data.retrieval.chunks.length,
 tone: "neutral" as const,
 },
 {
 id: "issues",
 label: "Pontos jurídicos",
 count: data.reasoning.issues.length,
 tone: data.reasoning.issues.length > 0 ? ("info" as const) : ("neutral" as const),
 },
 {
 id: "risks",
 label: "Riscos",
 count: data.reasoning.risks.length,
 tone:
 data.reasoning.risks.length === 0
 ? ("ok" as const)
 : data.reasoning.risks.length > 2
 ? ("danger" as const)
 : ("warning" as const),
 },
 {
 id: "strategy",
 label: "Estratégia",
 count: data.reasoning.strategy.arguments.length,
 tone: "ok" as const,
 },
 ];
 return (
 <section
 aria-label="Trust UX overview"
 className="rounded-xl border border-[color:var(--border-default)] bg-[color:var(--surface-overlay-strong)] p-4 space-y-4"
 >
 <div className="flex flex-wrap items-center justify-between gap-4">
 <ReasoningMap steps={reasoningSteps} />
 <div className="flex items-center gap-4">
 <ConfidenceMeter
 value={data.retrieval.confidence.score}
 label={`Confiança ${data.retrieval.confidence.label}`}
 />
 <DivergenceIndicator
 level={divergenceLevel}
 count={divergencesCount}
 detail={
 divergencesCount > 0
 ? "Sinalizado pelo motor de divergência cross-tribunal"
 : "Nenhum sinal automático no recorte atual"
 }
 />
 </div>
 </div>
 <div className="grid gap-3 lg:grid-cols-2">
 <div className="space-y-2 rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay-strong)] p-3">
 <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
 Força argumentativa
 </div>
 <ForceBar value={argScore} label="Alinhamento ao tribunal" hint={data.strategic.tribunalFavorability.verdict} />
 <ForceBar
 value={Math.min(1, data.research.thesisGroups[0]?.dominantScore ?? 0)}
 label="Tese dominante (líder)"
 />
 <ForceBar
 value={data.retrieval.groundingScore}
 label="Grounding global"
 />
 </div>
 <div className="space-y-2 rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay-strong)] p-3">
 <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
 Heatmap de fundamentação ({top.length} trechos)
 </div>
 <GroundingHeatmap items={top} />
 </div>
 </div>
 </section>
 );
}
