"use client";

import { useCallback, useMemo, useState } from "react";
import { Search, Sparkles, Layers, GitBranch, Loader2 } from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GroundingPanel } from "@/components/retrieval/grounding-panel";
import { CitationGraph } from "@/components/retrieval/citation-graph";
import { LegalTimelineList } from "@/components/retrieval/legal-timeline";
import { StrategyCard } from "@/components/retrieval/strategy-card";
import { IssuesList } from "@/components/retrieval/issues-list";
import { ReasoningTrace } from "@/components/retrieval/reasoning-trace";
import { RetrievedChunkCard } from "@/components/retrieval/retrieved-chunk-card";
import type {
 LegalRetrievalResult,
 LegalRetrievedChunk,
} from "@/lib/retrieval/legal/types";
import type { LegalIssue } from "@/lib/legal/reasoning/issue-spotting";
import type { ContradictionRisk } from "@/lib/legal/reasoning/contradiction";
import type { StrategySynthesis } from "@/lib/legal/reasoning/strategy";
import type { NormTimeline } from "@/lib/legal/reasoning/timeline";

type ExplainResponse = {
 retrieval: LegalRetrievalResult;
 reasoning: {
 issues: LegalIssue[];
 risks: ContradictionRisk[];
 strategy: StrategySynthesis;
 timelines: NormTimeline[];
 };
};

const SAMPLE_QUERIES = [
 "art. 5º da CF/88 direitos fundamentais",
 "súmula vinculante 14 acesso a investigação",
 "direito de arrependimento do consumidor",
];

export default function RetrievalExplainClientPage() {
 const [q, setQ] = useState(SAMPLE_QUERIES[0]!);
 const [loading, setLoading] = useState(false);
 const [data, setData] = useState<ExplainResponse | null>(null);
 const [error, setError] = useState<string | null>(null);

 const run = useCallback(async () => {
 if (q.trim().length < 2) return;
 setLoading(true);
 setError(null);
 try {
 const res = await fetch(
 `/api/retrieval/explain?q=${encodeURIComponent(q)}&topK=8&useGraph=true&useRerank=true`,
 );
 if (!res.ok) {
 const body = (await res.json().catch(() => ({}))) as { error?: string };
 throw new Error(body.error ?? `falha ${res.status}`);
 }
 const json = (await res.json()) as ExplainResponse;
 setData(json);
 } catch (err) {
 setError((err as Error).message);
 } finally {
 setLoading(false);
 }
 }, [q]);

 return (
 <AppShell title="Retrieval auditável">
 <div className="mx-auto max-w-6xl space-y-6">
 <Header q={q} setQ={setQ} run={run} loading={loading} />

 {!data && !loading && !error && <EmptyState onSample={(s) => setQ(s)} />}

 {error && (
 <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-300">
 <strong>Erro:</strong> {error}
 </div>
 )}

 {loading && <LoadingSkeleton />}

 {data && <Results data={data} />}
 </div>
 </AppShell>
 );
}

function Header({
 q,
 setQ,
 run,
 loading,
}: {
 q: string;
 setQ: (s: string) => void;
 run: () => void;
 loading: boolean;
}) {
 return (
 <header className="space-y-3">
 <div className="flex items-center gap-2">
 <Sparkles className="size-4 text-indigo-300" />
 <h1 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
 Retrieval jurídico auditável
 </h1>
 </div>
 <p className="text-base text-foreground">
 Veja <strong>como</strong> a IA recuperou cada fonte: pipeline cronometrado, scores discriminados, cadeia de
 citações, vigências, riscos jurídicos e síntese estratégica.
 </p>
 <div className="flex items-center gap-2">
 <div className="relative flex-1">
 <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
 <Input
 value={q}
 onChange={(e) => setQ(e.target.value)}
 placeholder='ex.: "súmula vinculante 14 sobre acesso à investigação"'
 className="pl-9"
 onKeyDown={(e) => e.key === "Enter" && !loading && run()}
 />
 </div>
 <Button onClick={run} disabled={loading || q.trim().length < 2}>
 {loading ? (
 <>
 <Loader2 className="mr-1.5 size-4 animate-spin" /> Analisando…
 </>
 ) : (
 <>Explicar</>
 )}
 </Button>
 </div>
 </header>
 );
}

function EmptyState({ onSample }: { onSample: (s: string) => void }) {
 return (
 <div className="rounded-xl border border-dashed bg-card/30 p-8 text-center">
 <Layers className="mx-auto size-8 text-muted-foreground" />
 <h3 className="mt-2 text-sm font-semibold text-foreground">Faça uma pergunta jurídica</h3>
 <p className="mt-1 text-xs text-muted-foreground">
 O Lex executa BM25 + dense + grafo + rerank, aplica boosts hierárquicos/temporais e devolve explicabilidade
 completa por chunk.
 </p>
 <div className="mt-4 flex flex-wrap justify-center gap-2">
 {SAMPLE_QUERIES.map((s) => (
 <button
 key={s}
 onClick={() => onSample(s)}
 className="rounded-md border bg-background/40 px-3 py-1 text-xs text-muted-foreground hover:bg-background/80 hover:text-foreground"
 >
 {s}
 </button>
 ))}
 </div>
 </div>
 );
}

function LoadingSkeleton() {
 return (
 <div className="space-y-4">
 <div className="h-24 animate-pulse rounded-xl border bg-card/30" />
 <div className="grid gap-4 lg:grid-cols-3">
 <div className="h-72 animate-pulse rounded-xl border bg-card/30 lg:col-span-2" />
 <div className="h-72 animate-pulse rounded-xl border bg-card/30" />
 </div>
 </div>
 );
}

function Results({ data }: { data: ExplainResponse }) {
 const { retrieval, reasoning } = data;
 const graph = useMemo(() => buildGraphData(retrieval.chunks), [retrieval.chunks]);

 return (
 <div className="space-y-5">
 <GroundingPanel
 score={retrieval.groundingScore}
 label={retrieval.confidence.label}
 reason={retrieval.confidence.reason}
 candidates={retrieval.trace.candidates}
 />

 <div className="grid gap-5 lg:grid-cols-3">
 <section className="lg:col-span-2">
 <Tabs defaultValue="chunks" className="w-full">
 <TabsList className="w-full justify-start">
 <TabsTrigger value="chunks">
 <Layers className="mr-1.5 size-3.5" />
 Fontes ({retrieval.chunks.length})
 </TabsTrigger>
 <TabsTrigger value="trace">
 <GitBranch className="mr-1.5 size-3.5" />
 Trace
 </TabsTrigger>
 <TabsTrigger value="graph">Cadeia</TabsTrigger>
 <TabsTrigger value="timeline">Vigências</TabsTrigger>
 </TabsList>
 <TabsContent value="chunks" className="space-y-3">
 {retrieval.chunks.length === 0 ? (
 <EmptyResultsBlock />
 ) : (
 retrieval.chunks.map((c, i) => <RetrievedChunkCard key={c.chunkId} chunk={c} rank={i + 1} />)
 )}
 </TabsContent>
 <TabsContent value="trace">
 <ReasoningTrace trace={retrieval.trace} rewrites={retrieval.rewrittenQueries} />
 </TabsContent>
 <TabsContent value="graph">
 <CitationGraph nodes={graph.nodes} edges={graph.edges} rootId={graph.rootId} />
 </TabsContent>
 <TabsContent value="timeline">
 <LegalTimelineList timelines={reasoning.timelines} />
 </TabsContent>
 </Tabs>
 </section>

 <aside className="space-y-4">
 <StrategyCard strategy={reasoning.strategy} />
 <IssuesList issues={reasoning.issues} />
 </aside>
 </div>
 </div>
 );
}

function EmptyResultsBlock() {
 return (
 <div className="flex h-32 items-center justify-center rounded-xl border border-dashed bg-card/30 text-sm text-muted-foreground">
 Nenhum chunk recuperado. Tente refinar a query ou ampliar o corpus.
 </div>
 );
}

function buildGraphData(chunks: LegalRetrievedChunk[]): {
 nodes: Array<{ id: string; label: string; kind: string }>;
 edges: Array<{ from: string; to: string; kind: "in" | "out" | "rerank" }>;
 rootId?: string;
} {
 if (chunks.length === 0) return { nodes: [], edges: [] };
 const byUrn = new Map<string, { id: string; label: string; kind: string }>();
 for (const c of chunks) {
 if (!byUrn.has(c.norm.urn)) {
 byUrn.set(c.norm.urn, {
 id: c.norm.urn,
 label: c.norm.identifier ?? c.norm.title,
 kind: c.norm.kind,
 });
 }
 }
 const nodes = Array.from(byUrn.values());
 const rootId = nodes[0]?.id;

 const edges: Array<{ from: string; to: string; kind: "in" | "out" | "rerank" }> = [];
 for (const c of chunks.slice(1)) {
 const dir = c.provenance.includes("graph_citation_out")
 ? "out"
 : c.provenance.includes("graph_citation_in")
 ? "in"
 : "rerank";
 if (rootId) edges.push({ from: rootId, to: c.norm.urn, kind: dir });
 }
 return rootId ? { nodes, edges, rootId } : { nodes, edges };
}

