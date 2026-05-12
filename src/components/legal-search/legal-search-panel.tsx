"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Loader2, AlertTriangle, Pin, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { LIBRARY_BADGE_OPT_IN_SEARCH, INTERNAL_SEARCH_SCOPE_REMINDER } from "@/lib/ui/product-terminology";
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogTrigger,
} from "@/components/ui/dialog";

interface SearchBase {
 key: string;
 label: string;
 available: boolean;
 hint?: string;
}

interface SearchResult {
 id: string;
 text: string;
 snippet?: string;
 articleRef: string | null;
 hierarchy: string | null;
 score: number;
 source?: string;
 reason?: string;
 origin?: string;
 referenceDate?: string;
 norm: {
 id: string;
 urn: string;
 kind: string;
 identifier: string | null;
 title: string;
 jurisdiction: string;
 tribunal: string | null;
 };
}

interface LibraryMatch {
 id: string;
 title: string;
 tags: string[];
 href: string;
 origin?: string;
 reason?: string;
 optInRag: boolean;
 useAsModel: boolean;
 useAsStyle: boolean;
}

interface CasePin {
 id: string;
 chunkId: string;
 excerpt: string;
 articleRef: string | null;
 normUrn: string | null;
 createdAt: string;
 origin?: string;
 reason?: string;
}

interface PieceMatch {
 id: string;
 title: string;
 kind: string;
 href: string;
 updatedAt: string;
 origin?: string;
 reason?: string;
}

interface SearchResponse {
 query: string;
 scope: string;
 caseId: string | null;
 layers?: string[];
 results: SearchResult[];
 libraryMatches?: LibraryMatch[];
 casePins?: CasePin[];
 pieceMatches?: PieceMatch[];
 pendingLayers?: string[];
 total: number;
 bases: SearchBase[];
 confidence: { label: string; score: number; reason: string } | null;
 cached?: boolean;
 /** True quando env desliga corpus jurídico e/ou vetor workspace. */
 corpusSearchConfigMuted?: boolean;
}

type FetchState =
 | { kind: "idle" }
 | { kind: "loading" }
 | { kind: "ok"; data: SearchResponse }
 | { kind: "empty"; data: SearchResponse }
 | { kind: "error"; message: string };

const LAYER_OPTS: { id: string; label: string; needsCase?: boolean }[] = [
 { id: "legislacao", label: "Legislação (corpus indexado)" },
 { id: "escritorio", label: "Documentos indexados" },
 { id: "fundamentos", label: "Fundamentos salvos (texto)" },
 { id: "caso", label: "Deste caso (fixados)", needsCase: true },
 { id: "pecas", label: "Peças (títulos)" },
 { id: "jurisprudencia", label: "Jurisprudência (em breve)" },
];

function defaultLayerSet(caseId: string | null): Set<string> {
 const s = new Set(["legislacao", "escritorio", "fundamentos", "pecas"]);
 if (caseId) s.add("caso");
 return s;
}

function parseLayersFromUrl(raw: string | null, caseId: string | null): Set<string> {
 const d = defaultLayerSet(caseId);
 if (!raw?.trim()) return d;
 const parts = raw.split(",").map((p) => p.trim().toLowerCase());
 const next = new Set<string>();
 for (const p of parts) {
 if (LAYER_OPTS.some((o) => o.id === p)) {
 if (p === "caso" && !caseId) continue;
 next.add(p);
 }
 }
 return next.size > 0 ? next : d;
}

function totalHits(d: SearchResponse): number {
 return (
 d.results.length +
 (d.libraryMatches?.length ?? 0) +
 (d.casePins?.length ?? 0) +
 (d.pieceMatches?.length ?? 0)
 );
}

function normKindLabel(r: SearchResult): string | null {
 if (r.norm.urn.toLowerCase().includes("!adct")) return "ADCT";
 const raw = (r.norm.kind ?? "").trim();
 if (!raw) return null;
 const k = raw.toLowerCase().replace(/_/g, "");
 const byEnum: Record<string, string> = {
 constitution: "Constituição",
 constitutionalamendment: "Emenda constitucional",
 ordinarylaw: "Lei",
 complementarylaw: "Lei complementar",
 delegatedlaw: "Lei delegada",
 decreelaw: "Decreto-lei",
 decree: "Decreto",
 provisionalmeasure: "Medida provisória",
 code: "Código",
 resolution: "Resolução",
 portaria: "Portaria",
 normativeinstruction: "Instrução normativa",
 circular: "Circular",
 regiment: "Regimento interno",
 sumulastf: "Súmula (STF)",
 sumulastj: "Súmula (STJ)",
 sumulavinculante: "Súmula vinculante",
 repetitivetheme: "Tema repetitivo",
 jurisprudencestf: "Jurisprudência (STF)",
 jurisprudencestj: "Jurisprudência (STJ)",
 jurisprudencetst: "Jurisprudência (TST)",
 jurisprudenceother: "Jurisprudência",
 other: "Norma",
 };
 if (byEnum[k]) return byEnum[k];
 if (k.includes("jurisprudence")) return "Jurisprudência";
 if (k.includes("sumula")) return "Súmula";
 if (k.includes("constitution")) return "Constituição";
 return null;
}

function relevanceLabel(score: number): { label: string; hint: string } {
 if (score >= 0.86) return { label: "Alta", hint: "Muito relacionado ao que você buscou." };
 if (score >= 0.72) return { label: "Média", hint: "Relacionado ao tema, com alguma distância." };
 return { label: "Baixa", hint: "Pode ajudar como apoio, mas não é o principal." };
}

export function LegalSearchPanel({
 embeddedCaseId,
}: {
 embeddedCaseId?: string;
} = {}) {
 const sp = useSearchParams();
 const router = useRouter();
 const initialQ = sp?.get("q") ?? "";
 const scope = sp?.get("scope") ?? "tudo";
 const caseId = embeddedCaseId ?? sp?.get("caseId") ?? null;

 const [q, setQ] = useState(initialQ);
 const [state, setState] = useState<FetchState>({ kind: "idle" });
 const [pinning, setPinning] = useState<string | null>(null);
 const [pinned, setPinned] = useState<Set<string>>(new Set());
 const [pinError, setPinError] = useState<string | null>(null);
 const [layers, setLayers] = useState<Set<string>>(() =>
 parseLayersFromUrl(sp?.get("layers") ?? null, caseId),
 );

 const toggleLayer = useCallback((id: string) => {
 setLayers((prev) => {
 const next = new Set(prev);
 if (next.has(id)) next.delete(id);
 else next.add(id);
 if (next.size === 0) return defaultLayerSet(caseId);
 return next;
 });
 }, [caseId]);

 const run = useCallback(
 async (query: string) => {
 if (query.trim().length < 2) return;
 setState({ kind: "loading" });
 try {
 const url = new URL("/api/retrieval/search", window.location.origin);
 url.searchParams.set("q", query);
 url.searchParams.set("scope", scope);
 if (caseId) url.searchParams.set("caseId", caseId);
 url.searchParams.set("layers", [...layers].join(","));
 const res = await fetch(url.toString());
 const requestId = res.headers.get("x-request-id");
 if (!res.ok) {
 const detail = await res.text().catch(() => "");
 throw new Error(detail || `HTTP ${res.status}${requestId ? ` · ${requestId}` : ""}`);
 }
 const data = (await res.json()) as SearchResponse;
 const hits = totalHits(data);
 setState({ kind: hits === 0 ? "empty" : "ok", data });
 } catch (e) {
 setState({
 kind: "error",
 message: e instanceof Error ? e.message : String(e),
 });
 }
 },
 [caseId, layers, scope],
 );

 useEffect(() => {
 if (initialQ.trim().length >= 2) void run(initialQ);
 // eslint-disable-next-line react-hooks/exhaustive-deps -- auto-busca só na carga inicial
 }, [initialQ]);

 async function pin(r: SearchResult) {
 if (!caseId) return;
 setPinError(null);
 setPinning(r.id);
 try {
 const res = await fetch(`/api/cases/${caseId}/legal-sources`, {
 method: "POST",
 headers: { "content-type": "application/json" },
 body: JSON.stringify({
 chunkId: r.id,
 normUrn: r.norm.urn,
 articleRef: r.articleRef,
 excerpt: r.text.slice(0, 600),
 query: q,
 }),
 });
 if (!res.ok && res.status !== 409) {
 throw new Error(`HTTP ${res.status}`);
 }
 setPinned((s) => new Set(s).add(r.id));
 if (embeddedCaseId) router.refresh();
 } catch (e) {
 setPinError(e instanceof Error ? e.message : String(e));
 } finally {
 setPinning(null);
 }
 }

 const bases = useMemo(() => {
 if (state.kind === "ok" || state.kind === "empty") return state.data.bases;
 return DEFAULT_BASES;
 }, [state]);

 return (
 <div className="space-y-4">
 <BasesBadges bases={bases} />

 <Card className="p-3">
 <p className="mb-2 text-[11px] font-medium text-muted-foreground">Camadas da busca</p>
 <div className="flex flex-wrap gap-2">
 {LAYER_OPTS.map((opt) => {
 if (opt.needsCase && !caseId) return null;
 const on = layers.has(opt.id);
 return (
 <Button
 key={opt.id}
 type="button"
 size="sm"
 variant={on ? "secondary" : "outline"}
 className="h-7 text-[10px]"
 onClick={() => toggleLayer(opt.id)}
 >
 {opt.label}
 </Button>
 );
 })}
 </div>
 </Card>

 <form
 className="flex flex-wrap gap-2"
 onSubmit={(e) => {
 e.preventDefault();
 void run(q);
 }}
 >
 <Input
 name="q"
 value={q}
 onChange={(e) => setQ(e.target.value)}
 placeholder="Ex.: devido processo legal, art. 5º LV, contraditório…"
 className="flex-1"
 />
 <Button type="submit" disabled={q.trim().length < 2 || state.kind === "loading"}>
 {state.kind === "loading" ? (
 <Loader2 className="mr-1 size-4 animate-spin" />
 ) : (
 <Search className="mr-1 size-4" />
 )}
 Buscar
 </Button>
 </form>

 {pinError ? (
 <Card className="border-rose-500/30 bg-rose-500/5 p-3 text-xs text-rose-200">
 <AlertTriangle className="mr-1 inline size-3" />
 Não foi possível salvar o fundamento no caso: {pinError}
 </Card>
 ) : null}

 <Body state={state} caseId={caseId} pinning={pinning} pinned={pinned} onPin={pin} />
 </div>
 );
}

function Body({
 state,
 caseId,
 pinning,
 pinned,
 onPin,
}: {
 state: FetchState;
 caseId: string | null;
 pinning: string | null;
 pinned: Set<string>;
 onPin: (r: SearchResult) => void;
}) {
 if (state.kind === "idle") {
 return (
 <EmptyState
 icon={<BookOpen className="size-5" />}
 title="Pesquisa jurídica em camadas"
 description={`Combine legislação indexada, trechos dos documentos do workspace, peças e (com caso aberto) fundamentos já salvos no caso. ${INTERNAL_SEARCH_SCOPE_REMINDER}`}
 />
 );
 }
 if (state.kind === "loading") {
 return (
 <div className="space-y-2">
 {[0, 1, 2].map((i) => (
 <Card key={i} className="h-20 animate-pulse" />
 ))}
 </div>
 );
 }
 if (state.kind === "error") {
 return (
 <Card className="border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-200">
 <AlertTriangle className="mr-1 inline size-4" />
 Não foi possível buscar agora. Tente novamente em alguns segundos.
 <p className="mt-1 text-[11px] opacity-70">{state.message}</p>
 </Card>
 );
 }
 if (state.kind === "empty") {
 return (
 <EmptyState
 icon={<Search className="size-5" />}
 title="Nenhum resultado nestas camadas"
 description="Tente outro termo, ative mais camadas acima ou abra um caso para buscar fixações locais."
 />
 );
 }

 const d = state.data;
 const pending = d.pendingLayers ?? [];

 return (
 <div className="space-y-6">
 {pending.length > 0 ? (
 <Card className="border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-100">
 Camadas previstas, ainda sem base nesta versão: {pending.join(", ")}.
 </Card>
 ) : null}

 {d.results.length > 0 ? (
 <section className="space-y-2">
 <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
 Legislação e corpus indexado
 </h3>
 <ul className="space-y-2">
 {d.results.map((r) => {
 const isPinned = pinned.has(r.id);
 const isPinning = pinning === r.id;
 return (
 <li key={r.id}>
 <Card className="p-3">
 <div className="flex flex-wrap items-start gap-2">
 <div className="min-w-0 flex-1 space-y-1">
 <div className="flex flex-wrap gap-1">
 {r.articleRef ? (
 <Badge variant="outline" className="text-[10px]">
 {r.articleRef}
 </Badge>
 ) : null}
 <Badge variant="outline" className="text-[10px]">
 {r.norm.identifier ?? r.norm.title}
 </Badge>
 {normKindLabel(r) ? (
 <Badge variant="outline" className="text-[10px]">
 {normKindLabel(r)}
 </Badge>
 ) : null}
 </div>
 <p className="text-sm leading-relaxed">{r.snippet ?? r.text}</p>
 <MetaLine
 source={r.source ?? r.norm.title}
 origin={r.origin}
 reason={r.reason}
 date={r.referenceDate}
 />
 {r.snippet && r.snippet !== r.text ? (
 <Dialog>
 <DialogTrigger asChild>
 <button
 type="button"
 className="text-[11px] text-violet-300 underline-offset-2 hover:underline"
 >
 Ver texto completo na norma
 </button>
 </DialogTrigger>
 <DialogContent className="max-w-2xl">
 <DialogHeader>
 <DialogTitle className="text-sm">
 {r.norm.identifier ?? r.norm.title}
 {r.articleRef ? ` — ${r.articleRef}` : ""}
 </DialogTitle>
 </DialogHeader>
 <div className="max-h-[60vh] overflow-auto whitespace-pre-wrap text-sm leading-relaxed">
 {r.text}
 </div>
 </DialogContent>
 </Dialog>
 ) : null}
 {r.hierarchy ? (
 <p className="text-[11px] text-muted-foreground">{r.hierarchy}</p>
 ) : null}
 </div>
 <div className="flex flex-col items-end gap-1">
 <Badge
 variant="outline"
 className="text-[10px]"
 title={relevanceLabel(r.score).hint}
 >
 Relevância: {relevanceLabel(r.score).label}
 </Badge>
 {caseId ? (
 <Button
 variant={isPinned ? "ghost" : "secondary"}
 size="sm"
 disabled={isPinning || isPinned}
 onClick={() => onPin(r)}
 >
 <Pin className="mr-1 size-3" />
 {isPinned
 ? "Já no caso"
 : isPinning
 ? "Salvando…"
 : "Adicionar ao caso"}
 </Button>
 ) : null}
 </div>
 </div>
 </Card>
 </li>
 );
 })}
 </ul>
 </section>
 ) : null}

 {(d.libraryMatches?.length ?? 0) > 0 ? (
 <section className="space-y-2">
 <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
 Documentos indexados e fundamentos
 </h3>
 <ul className="space-y-2">
 {(d.libraryMatches ?? []).map((f) => (
 <li key={f.id}>
 <Card className="p-3">
 <div className="flex flex-wrap items-start justify-between gap-2">
 <div className="min-w-0 space-y-1">
 <Link href={f.href} className="font-medium hover:underline">
 {f.title}
 </Link>
 <MetaLine source={f.title} origin={f.origin} reason={f.reason} />
 <div className="flex flex-wrap gap-1">
 {f.optInRag ? (
 <Badge className="text-[10px]">{LIBRARY_BADGE_OPT_IN_SEARCH}</Badge>
 ) : null}
 {f.useAsModel ? (
 <Badge variant="outline" className="text-[10px]">
 Modelo de peça
 </Badge>
 ) : null}
 {f.useAsStyle ? (
 <Badge variant="outline" className="text-[10px]">
 Referência de estilo
 </Badge>
 ) : null}
 </div>
 </div>
 <Button asChild size="sm" variant="outline">
 <Link href={f.href}>Abrir</Link>
 </Button>
 </div>
 </Card>
 </li>
 ))}
 </ul>
 </section>
 ) : null}

 {(d.casePins?.length ?? 0) > 0 ? (
 <section className="space-y-2">
 <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
 Fundamentos já usados neste caso
 </h3>
 <ul className="space-y-2">
 {(d.casePins ?? []).map((p) => (
 <li key={p.id}>
 <Card className="p-3 text-sm">
 <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground">
 {p.articleRef ? <Badge variant="outline">{p.articleRef}</Badge> : null}
 {p.normUrn ? (
 <Badge variant="outline" className="max-w-[220px] truncate font-mono">
 {p.normUrn}
 </Badge>
 ) : null}
 </div>
 <p className="mt-2 leading-relaxed">{p.excerpt}</p>
 <MetaLine
 source="Fixação no caso"
 origin={p.origin}
 reason={p.reason}
 date={p.createdAt}
 />
 </Card>
 </li>
 ))}
 </ul>
 </section>
 ) : null}

 {(d.pieceMatches?.length ?? 0) > 0 ? (
 <section className="space-y-2">
 <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
 Peças relacionadas
 </h3>
 <ul className="space-y-2">
 {(d.pieceMatches ?? []).map((p) => (
 <li key={p.id}>
 <Card className="p-3">
 <div className="flex flex-wrap items-start justify-between gap-2">
 <div>
 <Link href={p.href} className="font-medium hover:underline">
 {p.title}
 </Link>
 <p className="mt-1 text-[11px] text-muted-foreground">
 <Badge variant="outline" className="text-[10px]">
 {p.kind}
 </Badge>{" "}
 · Atualizada {new Date(p.updatedAt).toLocaleDateString("pt-BR")}
 </p>
 <MetaLine source={p.title} origin={p.origin} reason={p.reason} />
 </div>
 <Button asChild size="sm" variant="secondary">
 <Link href={p.href}>Abrir peça</Link>
 </Button>
 </div>
 </Card>
 </li>
 ))}
 </ul>
 </section>
 ) : null}
 </div>
 );
}

function MetaLine({
 source,
 origin,
 reason,
 date,
}: {
 source: string;
 origin?: string;
 reason?: string;
 date?: string;
}) {
 const parts = [
 `Fonte: ${source}`,
 origin ? `Origem: ${origin}` : null,
 reason ? `Motivo: ${reason}` : null,
 date ? `Data: ${new Date(date).toLocaleDateString("pt-BR")}` : null,
 ].filter(Boolean);
 return <p className="text-[11px] leading-snug text-muted-foreground">{parts.join(" · ")}</p>;
}

function BasesBadges({ bases }: { bases: SearchBase[] }) {
 return (
 <div className="flex flex-wrap gap-1">
 {bases.map((b) => (
 <Badge
 key={b.key}
 variant="outline"
 className={`text-[10px] ${
 b.available
 ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-200"
 : "border-[color:var(--border-default)] text-muted-foreground"
 }`}
 title={b.hint ?? undefined}
 >
 {b.label}
 {b.hint ? ` · ${b.hint}` : ""}
 </Badge>
 ))}
 </div>
 );
}

const DEFAULT_BASES: SearchBase[] = [
 { key: "cf", label: "Constituição Federal", available: true },
 { key: "adct", label: "ADCT", available: true },
];
