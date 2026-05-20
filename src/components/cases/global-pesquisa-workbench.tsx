"use client";

/**
 * P0 — Fluxo do caso reorganizado.
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/UX_FLOW_AUDIT.md
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BookOpen, ClipboardCopy, Filter, Pin, Scale, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import type { LegalResearchResponse, LegalResearchResultType } from "@/lib/legal-research/types";
import {
 translateTerm,
 USER_FACING_MESSAGES,
} from "@/lib/ui/product-terminology";
const TAB_TO_TYPES = {
 all: ["LAW", "JURISPRUDENCE", "THESIS", "STRATEGY", "DRAFTING_SUPPORT"],
 laws: ["LAW"],
 juris: ["JURISPRUDENCE"],
 thesis: ["THESIS"],
 strategy: ["STRATEGY", "DRAFTING_SUPPORT"],
} as const satisfies Record<string, readonly LegalResearchResultType[]>;

type TabKey = keyof typeof TAB_TO_TYPES;

export function GlobalPesquisaWorkbench() {
 const sp = useSearchParams();
 const initialQ = sp.get("q") ?? "";
 const caseId = sp.get("caseId");

 const [query, setQuery] = useState(initialQ);
 const [debounced, setDebounced] = useState(initialQ);
 const [tab, setTab] = useState("all");
 const [tribunal, setTribunal] = useState("");
 const [area, setArea] = useState("");
 const [periodo, setPeriodo] = useState("");
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [data, setData] = useState<LegalResearchResponse | null>(null);
 const inputRef = useRef<HTMLInputElement>(null);

 useEffect(() => {
 inputRef.current?.focus();
 }, []);

 useEffect(() => {
 const t = setTimeout(() => setDebounced(query.trim()), 250);
 return () => clearTimeout(t);
 }, [query]);

 const runSearch = useCallback(async () => {
 if (!debounced) {
 setData(null);
 setError(null);
 return;
 }
 setLoading(true);
 setError(null);
 try {
 const tabKey = (tab in TAB_TO_TYPES ? tab : "all") as TabKey;
 const resultTypes = [...TAB_TO_TYPES[tabKey]];
 const body = caseId
 ? {
 caseId,
 query: debounced,
 resultTypes,
 maxResults: 12,
 language: "pt-BR" as const,
 }
 : {
 query: debounced,
 resultTypes,
 maxResults: 12,
 language: "pt-BR" as const,
 };
 const url = caseId ? `/api/legal-research/recommend-for-case` : `/api/legal-research/search`;
 const res = await fetch(url, {
 method: "POST",
 headers: { "content-type": "application/json" },
 body: JSON.stringify(body),
 });
 const json = (await res.json()) as LegalResearchResponse & { error?: string };
 if (!res.ok) {
 const msg =
 json.error ||
 (res.status === 503
 ? "Pesquisa assistida temporariamente indisponível. Tente de novo em instantes."
 : `Não foi possível concluir a pesquisa (${res.status}).`);
 throw new Error(msg);
 }
 setData(typeof json.summary === "string" ? json : null);
 } catch (e) {
 setData(null);
 setError(e instanceof Error ? e.message : "Não foi possível concluir a pesquisa.");
 } finally {
 setLoading(false);
 }
 }, [caseId, debounced, tab]);

 useEffect(() => {
 void runSearch();
 }, [runSearch]);

 return (
 <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
 <div className="space-y-4">
 <Card className="border-primary/20 bg-card p-4 text-xs leading-relaxed text-muted-foreground shadow-sm">
 {USER_FACING_MESSAGES.DEEPSEEK_TRANSPARENCY_TOP}
 </Card>

 <Card className="border-border bg-card p-4 shadow-sm">
 <label htmlFor="global-legal-search" className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
 Pergunta ou tema jurídico
 </label>
 <div className="relative">
 <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
 <Input
 ref={inputRef}
 id="global-legal-search"
 value={query}
 onChange={(e) => setQuery(e.target.value)}
 onKeyDown={(e) => {
 if (e.key === "Enter") void runSearch();
 }}
 placeholder="Ex.: direito do consumidor em contratos bancários…"
 className="h-12 border-border bg-background pl-10 text-base shadow-inner"
 autoComplete="off"
 aria-describedby="search-hint"
 />
 </div>
 <p id="search-hint" className="mt-2 text-[11px] text-muted-foreground">
 Pressione Enter para buscar imediatamente. A busca assistida aguarda 250 ms após digitar.
 </p>
 </Card>

 <Card className="border-border bg-card p-4 shadow-sm">
 <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
 <Filter className="size-3.5" aria-hidden /> Filtros
 </div>
 <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
 <div>
 <label className="mb-1 block text-[11px] text-muted-foreground" htmlFor="flt-trib">
 Tribunal
 </label>
 <Input id="flt-trib" value={tribunal} onChange={(e) => setTribunal(e.target.value)} placeholder="Ex.: TJSP" />
 </div>
 <div>
 <label className="mb-1 block text-[11px] text-muted-foreground" htmlFor="flt-area">
 Área
 </label>
 <Input id="flt-area" value={area} onChange={(e) => setArea(e.target.value)} placeholder="Cível, consumidor…" />
 </div>
 <div>
 <label className="mb-1 block text-[11px] text-muted-foreground" htmlFor="flt-period">
 Período
 </label>
 <Input id="flt-period" value={periodo} onChange={(e) => setPeriodo(e.target.value)} placeholder="AAAA ou intervalo" />
 </div>
 <div>
 <label className="mb-1 block text-[11px] text-muted-foreground" htmlFor="flt-type">
 Tipo de resultado
 </label>
 <Input id="flt-type" readOnly value="Assistido (serviço externo temporário)" className="bg-muted/40" />
 </div>
 </div>
 </Card>

 <Tabs value={tab} onValueChange={setTab}>
 <TabsList className="flex h-auto min-h-10 w-full min-w-0 flex-nowrap justify-start gap-1 overflow-x-auto rounded-md bg-muted/50 p-1">
 <TabsTrigger value="all" className="shrink-0 focus-visible:ring-2 focus-visible:ring-ring">
 Todos
 </TabsTrigger>
 <TabsTrigger value="laws" className="shrink-0 focus-visible:ring-2 focus-visible:ring-ring">
 Leis
 </TabsTrigger>
 <TabsTrigger value="juris" className="shrink-0 focus-visible:ring-2 focus-visible:ring-ring">
 Jurisprudência
 </TabsTrigger>
 <TabsTrigger value="thesis" className="shrink-0 focus-visible:ring-2 focus-visible:ring-ring">
 Teses
 </TabsTrigger>
 <TabsTrigger value="strategy" className="shrink-0 focus-visible:ring-2 focus-visible:ring-ring">
 Estratégia
 </TabsTrigger>
 </TabsList>
 </Tabs>

 <div className="mt-4">
 <ResultsColumn
 loading={loading}
 error={error}
 data={data}
 tab={tab}
 caseId={caseId}
 hasQuery={Boolean(debounced)}
 onRetry={() => void runSearch()}
 />
 </div>
 </div>

 <aside className="lg:sticky lg:top-24 lg:self-start">
 <IaSidePanel data={data} loading={loading} error={error} />
 </aside>
 </div>
 );
}

function ResultsColumn({
 loading,
 error,
 data,
 tab,
 caseId,
 hasQuery,
 onRetry,
}: {
 loading: boolean;
 error: string | null;
 data: LegalResearchResponse | null;
 tab: string;
 caseId: string | null;
 hasQuery: boolean;
 onRetry: () => void;
}) {
 if (loading) {
 return (
 <div aria-live="polite" className="space-y-3">
 <Skeleton className="h-24 w-full" />
 <Skeleton className="h-24 w-full" />
 <Skeleton className="h-24 w-full" />
 </div>
 );
 }

 if (error) {
 return (
 <Card role="alert" className="border-rose-500/40 bg-rose-500/10 p-6 text-sm text-rose-100">
 <p>{error}</p>
 <Button type="button" variant="secondary" className="mt-4" onClick={onRetry}>
 Tentar novamente
 </Button>
 </Card>
 );
 }

 if (!hasQuery) {
 return (
 <Card className="flex flex-col items-center gap-3 border-dashed p-10 text-center text-sm text-muted-foreground">
 <BookOpen className="size-8 opacity-60" aria-hidden />
 <p>{USER_FACING_MESSAGES.GLOBAL_RESEARCH_EMPTY}</p>
 </Card>
 );
 }

 if (!data) {
 return (
 <Card className="border-dashed p-8 text-sm text-muted-foreground">
 <p>
 Não recebemos resultados para esta consulta. Verifique a pergunta, tente outro filtro ou
 aguarde um instante e tente novamente.
 </p>
 <Button type="button" variant="outline" size="sm" className="mt-4" onClick={onRetry}>
 Tentar novamente
 </Button>
 </Card>
 );
 }

 const cards: React.ReactNode[] = [];

 const showLaws = tab === "all" || tab === "laws";
 const showJuris = tab === "all" || tab === "juris";
 const showThesis = tab === "all" || tab === "thesis";
 const showStrategy = tab === "all" || tab === "strategy";

 if (showLaws) {
 data.legalFoundations?.forEach((f) => {
 cards.push(
 <li key={f.id}>
 <ResultCard
 title={f.title}
 typeLabel="Norma / fundamento"
 summary={f.whyRelevant}
 excerpt={f.excerpt}
 meta={f.citation}
 confidence={f.confidence}
 verification={translateTerm(f.verificationStatus)}
 actions={
 <>
 <IconAction label="Copiar citação" onClick={() => void navigator.clipboard.writeText(f.citation)} />
 {caseId ? (
 <Button type="button" size="sm" variant="secondary" asChild>
 <Link href={`/cases/${caseId}/pesquisa-juridica`}>Adicionar ao caso</Link>
 </Button>
 ) : (
 <Button type="button" size="sm" variant="ghost" asChild>
 <Link href="/pesquisa-juridica">Abrir pesquisa global</Link>
 </Button>
 )}
 <Button type="button" size="sm" variant="ghost" onClick={() => void navigator.clipboard.writeText(f.id)}>
 <Pin className="mr-1 size-3" aria-hidden />
 {translateTerm("Pin")}
 </Button>
 <Button type="button" size="sm" variant="outline">
 Marcar verificado
 </Button>
 </>
 }
 />
 </li>,
 );
 });
 }

 if (showJuris) {
 data.jurisprudenceCandidates?.forEach((j) => {
 cards.push(
 <li key={j.id}>
 <ResultCard
 title={j.title}
 typeLabel="Jurisprudência"
 summary={j.summary}
 excerpt={j.holding}
 meta={[j.court, j.processNumber].filter(Boolean).join(" · ")}
 confidence={j.confidence}
 verification={translateTerm(j.verificationStatus)}
 actions={
 <>
 <IconAction label="Copiar citação" onClick={() => void navigator.clipboard.writeText(j.title)} />
 {caseId ? (
 <Button type="button" size="sm" variant="secondary" asChild>
 <Link href={`/cases/${caseId}/pesquisa-juridica`}>Adicionar ao caso</Link>
 </Button>
 ) : null}
 <Button type="button" size="sm" variant="ghost">
 Marcar verificado
 </Button>
 </>
 }
 />
 </li>,
 );
 });
 }

 if (showThesis) {
 (data.strategyNotes ?? []).forEach((sn, idx) => {
 cards.push(
 <li key={`thesis-${idx}`}>
 <ResultCard
 title={sn.thesis}
 typeLabel="Tese sugerida"
 summary={sn.recommendedAction}
 excerpt={sn.factualRequirements.join(" · ") || sn.risk}
 meta={sn.risk}
 confidence={0.75}
 verification={translateTerm("AI_RECOMMENDED_UNVERIFIED")}
 actions={
 <>
 <IconAction label="Copiar tese" onClick={() => void navigator.clipboard.writeText(sn.thesis)} />
 {caseId ? (
 <Button type="button" size="sm" variant="secondary" asChild>
 <Link href={`/cases/${caseId}/estrategia`}>Adicionar à estratégia</Link>
 </Button>
 ) : null}
 </>
 }
 />
 </li>,
 );
 });
 }

 if (showStrategy) {
 (data.draftingSuggestions ?? []).forEach((text, idx) => {
 cards.push(
 <li key={`strat-${idx}`}>
 <ResultCard
 title="Sugestão de linha argumentativa"
 typeLabel="Estratégia"
 summary={text}
 excerpt={text}
 meta="Assistido"
 confidence={0.7}
 verification={translateTerm("AI_RECOMMENDED_UNVERIFIED")}
 actions={
 caseId ? (
 <Button type="button" size="sm" variant="secondary" asChild>
 <Link href={`/cases/${caseId}/estrategia`}>Usar na minuta</Link>
 </Button>
 ) : (
 <span className="text-[11px] text-muted-foreground">
 Abra a pesquisa a partir de um caso para vincular à minuta.
 </span>
 )
 }
 />
 </li>,
 );
 });
 }

 if (cards.length === 0) {
 return (
 <Card className="flex flex-col items-center gap-3 border-dashed p-10 text-center text-sm text-muted-foreground">
 <Scale className="size-8 opacity-60" aria-hidden />
 <p>Nenhum resultado nesta categoria para os filtros atuais.</p>
 </Card>
 );
 }

 return <ul className="space-y-3">{cards}</ul>;
}

function ResultCard({
 title,
 typeLabel,
 summary,
 excerpt,
 meta,
 confidence,
 verification,
 actions,
}: {
 title: string;
 typeLabel: string;
 summary: string;
 excerpt: string;
 meta: string;
 confidence: number;
 verification: string;
 actions: React.ReactNode;
}) {
 return (
 <Card className="border-border bg-card p-4 shadow-sm">
 <div className="flex flex-wrap items-start justify-between gap-2">
 <div className="min-w-0 flex-1 space-y-2">
 <p className="text-base font-semibold leading-snug text-foreground">{title}</p>
 <div className="flex flex-wrap gap-2">
 <Badge variant="secondary" className="text-[10px]">
 {typeLabel}
 </Badge>
 <Badge variant="outline" className="text-[10px]">
 Confiança: {Math.round(confidence * 100)}%
 </Badge>
 <Badge variant="outline" className="text-[10px]" title="Status de verificação">
 {verification}
 </Badge>
 </div>
 <p className="text-sm text-muted-foreground">{summary}</p>
 <blockquote className="border-l-2 border-primary/40 pl-3 text-sm italic text-foreground/90">{excerpt}</blockquote>
 <p className="text-[11px] text-muted-foreground">{meta}</p>
 <p className="text-[11px] text-amber-200/90">{USER_FACING_MESSAGES.AI_RESULT_REVIEW}</p>
 </div>
 </div>
 <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">{actions}</div>
 </Card>
 );
}

function IconAction({ label, onClick }: { label: string; onClick: () => void }) {
 return (
 <Button type="button" size="sm" variant="outline" aria-label={label} onClick={onClick}>
 <ClipboardCopy className="size-3.5" aria-hidden />
 <span className="sr-only">{label}</span>
 </Button>
 );
}

function IaSidePanel({
 data,
 loading,
 error,
}: {
 data: LegalResearchResponse | null;
 loading: boolean;
 error: string | null;
}) {
 return (
 <Card className="border-border bg-card p-4 shadow-md">
 <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
 <Sparkles className="size-4 text-primary" aria-hidden />
 Painel assistido
 </div>
 {loading ? (
 <div className="space-y-2" aria-live="polite">
 <Skeleton className="h-16 w-full" />
 <Skeleton className="h-16 w-full" />
 </div>
 ) : error ? (
 <p className="text-xs text-rose-200" role="alert">
 {error}
 </p>
 ) : !data ? (
 <p className="text-xs text-muted-foreground">
 Faça uma pergunta à esquerda para ver resumo, riscos e lacunas sugeridas.
 </p>
 ) : (
 <div className="space-y-4 text-xs text-muted-foreground">
 <section>
 <p className="mb-1 font-medium text-foreground">Resumo</p>
 <p>{data.summary}</p>
 </section>
 <section>
 <p className="mb-1 font-medium text-foreground">Fundamentos sugeridos</p>
 <ul className="list-inside list-disc space-y-1">
 {(data.legalFoundations ?? []).slice(0, 4).map((f) => (
 <li key={f.id}>{f.title}</li>
 ))}
 </ul>
 </section>
 <section>
 <p className="mb-1 font-medium text-foreground">Jurisprudências candidatas</p>
 <ul className="list-inside list-disc space-y-1">
 {(data.jurisprudenceCandidates ?? []).slice(0, 4).map((j) => (
 <li key={j.id}>{j.title}</li>
 ))}
 </ul>
 </section>
 <section>
 <p className="mb-1 font-medium text-foreground">Riscos</p>
 <ul className="list-inside list-disc space-y-1">
 {(data.riskFlags ?? []).map((r, i) => (
 <li key={i}>{r}</li>
 ))}
 </ul>
 </section>
 <section>
 <p className="mb-1 font-medium text-foreground">Lacunas</p>
 <ul className="list-inside list-disc space-y-1">
 {(data.missingInformation ?? []).map((m, i) => (
 <li key={i}>{m}</li>
 ))}
 </ul>
 </section>
 <section>
 <p className="mb-1 font-medium text-foreground">Próximas buscas recomendadas</p>
 <ul className="space-y-1">
 {(data.suggestedSearches ?? []).slice(0, 5).map((s) => (
 <li key={s}>
 <span className="text-foreground/80">· {s}</span>
 </li>
 ))}
 </ul>
 </section>
 </div>
 )}
 </Card>
 );
}
