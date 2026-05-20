"use client";

/**
 * P0 — Fluxo do caso reorganizado.
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/UX_FLOW_AUDIT.md
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
 AlertTriangle,
 ArrowRight,
 BookMarked,
 ClipboardCopy,
 Pin,
 Search,
 Sparkles,
 Trash2,
} from "lucide-react";
import type { Case, CaseLegalSource } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { LegalSearchPanel } from "@/components/legal-search/legal-search-panel";
import { CaseDataOriginButton } from "@/components/cases/case-data-origin";
import type { LegalResearchResponse, JurisprudenceCandidate } from "@/lib/legal-research/types";
import type { CaseBrainSnapshot } from "@/lib/cases/case-brain/snapshot";
import {
 translateTerm,
 USER_FACING_MESSAGES,
} from "@/lib/ui/product-terminology";

type CaseBrainLike = {
 narrative?: string;
 area?: string[];
 checklistResponses?: Record<string, unknown>;
};

type CaseRecord = Pick<Case, "id" | "metadataJson" | "rawInput" | "summary" | "title"> & {
 facts: { id: string }[];
 parties: { id: string }[];
 requests: { id: string }[];
 risks: { id: string }[];
 documents: { id: string; status: string }[];
};

function readBrain(meta: unknown): CaseBrainLike | null {
 if (!meta || typeof meta !== "object") return null;
 const m = meta as { brain?: unknown };
 const b = m.brain;
 if (!b || typeof b !== "object") return null;
 return b as CaseBrainLike;
}

function verificationLabel(status: string): string {
 return translateTerm(status);
}

interface Props {
 caseId: string;
 legalSources: CaseLegalSource[];
 caseRecord: CaseRecord;
}

export function CaseResearchTab({ caseId, legalSources, caseRecord }: Props) {
 const router = useRouter();
 const [busy, setBusy] = useState<string | null>(null);
 const [error, setError] = useState<string | null>(null);
 const [cbSnap, setCbSnap] = useState<CaseBrainSnapshot | null>(null);
 const [recoLoading, setRecoLoading] = useState(false);
 const [recoError, setRecoError] = useState<string | null>(null);
 const [reco, setReco] = useState<LegalResearchResponse | null>(null);

 useEffect(() => {
 let cancelled = false;
 (async () => {
 try {
 const res = await fetch(`/api/cases/${caseId}/case-brain`, { credentials: "include" });
 if (!res.ok) return;
 const json = (await res.json()) as CaseBrainSnapshot;
 if (!cancelled) setCbSnap(json);
 } catch {
 /* mantém fallback via metadataJson */
 }
 })();
 return () => {
 cancelled = true;
 };
 }, [caseId]);

 const { brain, brainEmpty } = useMemo(() => {
 const b = cbSnap?.brain ?? readBrain(caseRecord.metadataJson);
 const empty =
 !String(b?.narrative ?? "").trim() &&
 !String(caseRecord.rawInput ?? "").trim() &&
 (cbSnap?.facts.length ?? caseRecord.facts.length) === 0 &&
 (cbSnap?.parties.length ?? caseRecord.parties.length) === 0 &&
 (cbSnap?.claims.length ?? caseRecord.requests.length) === 0 &&
 (cbSnap?.risks.length ?? caseRecord.risks.length) === 0 &&
 (cbSnap?.documents.length ?? caseRecord.documents.length) === 0;
 return { brain: b, brainEmpty: empty };
 }, [cbSnap, caseRecord]);

 const loadRecommendations = useCallback(async () => {
 if (brainEmpty) {
 setReco(null);
 setRecoLoading(false);
 setRecoError(null);
 return;
 }
 setRecoError(null);
 setRecoLoading(true);
 try {
 const res = await fetch(`/api/legal-research/recommend-for-case`, {
 method: "POST",
 credentials: "include",
 headers: { "content-type": "application/json" },
 body: JSON.stringify({
 caseId,
 query: caseRecord.title?.trim() || "Contexto do caso",
 caseBrain: JSON.stringify({
 narrative: brain?.narrative ?? caseRecord.summary ?? "",
 areas: brain?.area ?? [],
 fingerprint: cbSnap?.caseFingerprint ?? null,
 counts: {
 facts: cbSnap?.facts.length ?? caseRecord.facts.length,
 parties: cbSnap?.parties.length ?? caseRecord.parties.length,
 requests: cbSnap?.claims.length ?? caseRecord.requests.length,
 risks: cbSnap?.risks.length ?? caseRecord.risks.length,
 documents: cbSnap?.documents.length ?? caseRecord.documents.length,
 },
 }),
 resultTypes: ["LAW", "JURISPRUDENCE", "THESIS", "STRATEGY", "DRAFTING_SUPPORT"],
 maxResults: 12,
 language: "pt-BR",
 }),
 });
 const data = (await res.json()) as LegalResearchResponse & { error?: string };
 if (!res.ok) {
 const msg =
 data.error ||
 (res.status === 503
 ? "Pesquisa assistida temporariamente indisponível. Tente de novo em instantes."
 : `Não foi possível carregar sugestões (${res.status}).`);
 throw new Error(msg);
 }
 if (typeof data.summary === "string") {
 setReco(data);
 } else {
 setReco(null);
 }
 } catch (e) {
 setReco(null);
 setRecoError(e instanceof Error ? e.message : "Falha ao carregar sugestões");
 } finally {
 setRecoLoading(false);
 }
 }, [brain?.area, brain?.narrative, brainEmpty, caseId, caseRecord, cbSnap]);

 useEffect(() => {
 void loadRecommendations();
 }, [loadRecommendations]);

 async function unpin(id: string) {
 setError(null);
 setBusy(id);
 try {
 const res = await fetch(`/api/cases/${caseId}/legal-sources?id=${id}`, {
 method: "DELETE",
 credentials: "include",
 });
 if (!res.ok) throw new Error(`HTTP ${res.status}`);
 router.refresh();
 } catch (e) {
 setError(e instanceof Error ? e.message : String(e));
 } finally {
 setBusy(null);
 }
 }

 async function pinFoundation(body: unknown) {
 try {
 const res = await fetch(`/api/legal-research/pin`, {
 method: "POST",
 credentials: "include",
 headers: { "content-type": "application/json" },
 body: JSON.stringify(body),
 });
 const data = (await res.json()) as { error?: string };
 if (!res.ok) {
 throw new Error(data.error || `Não foi possível fixar (${res.status}).`);
 }
 router.refresh();
 } catch (e) {
 setError(e instanceof Error ? e.message : String(e));
 }
 }

 async function pinJurisprudence(j: JurisprudenceCandidate) {
 await pinFoundation({ caseId, jurisprudence: j });
 }

 async function goToStrategy() {
 router.push(`/cases/${caseId}/estrategia`);
 }

 return (
 <div className="space-y-6">
 <Card className="border-primary/20 bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
 {USER_FACING_MESSAGES.DEEPSEEK_TRANSPARENCY_TOP}
 </Card>

 {brainEmpty ? (
 <Card className="flex flex-col items-center gap-3 border-dashed p-8 text-center">
 <Sparkles className="size-8 text-muted-foreground" aria-hidden />
 <p className="max-w-md text-sm text-muted-foreground">
 A inteligência deste caso ainda está vazia. Preencha a entrevista para gerarmos buscas e
 fundamentos alinhados ao relato.
 </p>
 <Button asChild>
          <Link href={`/cases/${caseId}/entrevista`}>
            Comece pela entrevista <ArrowRight className="ml-2 size-4" aria-hidden />
 </Link>
 </Button>
 </Card>
 ) : null}

 <section className="space-y-3" aria-labelledby="reco-heading">
 <div className="flex flex-wrap items-center justify-between gap-2">
 <h3 id="reco-heading" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
 Sugestões para este caso
 </h3>
 <Button
 type="button"
 variant="outline"
 size="sm"
 onClick={() => void loadRecommendations()}
 className="text-xs"
 >
 Atualizar sugestões
 </Button>
 </div>

 <div aria-live="polite" className="min-h-[4rem]">
 {recoLoading ? (
 <div className="grid gap-2 md:grid-cols-2">
 <Skeleton className="h-20 w-full" />
 <Skeleton className="h-20 w-full" />
 </div>
 ) : recoError ? (
 <Card role="alert" className="border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-100">
 <p>{recoError}</p>
 <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={() => void loadRecommendations()}>
 Tentar novamente
 </Button>
 </Card>
 ) : reco ? (
 <div className="space-y-6">
 {reco.suggestedSearches?.length ? (
 <div>
 <p className="mb-2 text-xs font-medium text-muted-foreground">
 Buscas recomendadas para este caso
 </p>
 <div className="flex flex-wrap gap-2">
 {reco.suggestedSearches.map((q) => (
 <Button key={q} type="button" size="sm" variant="secondary" asChild className="rounded-full text-xs font-normal">
                <Link
                  href={`/cases/${caseId}/pesquisa-juridica?q=${encodeURIComponent(q)}`}
                >
 {q}
 </Link>
 </Button>
 ))}
 </div>
 </div>
 ) : null}

 {reco.legalFoundations?.length ? (
 <div>
 <p className="mb-2 text-xs font-medium text-muted-foreground">Fundamentos sugeridos</p>
 <ul className="space-y-2">
 {reco.legalFoundations.map((f) => (
 <li key={f.id}>
 <Card className="p-3">
 <div className="flex flex-wrap items-start justify-between gap-2">
 <div className="min-w-0 flex-1 space-y-1">
 <p className="text-sm font-medium leading-snug">{f.title}</p>
 <p className="text-xs text-muted-foreground">{f.citation}</p>
 <Badge variant="outline" className="text-[10px]" aria-describedby={`vs-${f.id}`}>
 {verificationLabel(f.verificationStatus)}
 </Badge>
 <span id={`vs-${f.id}`} className="sr-only">
 Status: {verificationLabel(f.verificationStatus)}
 </span>
 <p className="text-xs leading-relaxed text-muted-foreground">{f.excerpt}</p>
 <p className="text-[11px] text-amber-200/90">{USER_FACING_MESSAGES.AI_RESULT_REVIEW}</p>
 </div>
 <div className="flex shrink-0 flex-col gap-1">
 <Button
 type="button"
 size="sm"
 variant="secondary"
 onClick={() => void pinFoundation({ caseId, foundation: f })}
 aria-label={translateTerm("Pin")}
 >
 <Pin className="mr-1 size-3" aria-hidden />
 {translateTerm("Pin")}
 </Button>
 <Button type="button" size="sm" variant="ghost" onClick={() => void goToStrategy()}>
 Abrir estratégia
 </Button>
 <Button type="button" size="sm" variant="ghost" asChild>
 <Link href={`/cases/${caseId}/estrategia`}>Usar na minuta</Link>
 </Button>
 </div>
 </div>
 </Card>
 </li>
 ))}
 </ul>
 </div>
 ) : null}

 {reco.jurisprudenceCandidates?.length ? (
 <div>
 <p className="mb-2 text-xs font-medium text-muted-foreground">Jurisprudências candidatas</p>
 <ul className="space-y-2">
 {reco.jurisprudenceCandidates.map((j) => (
 <li key={j.id}>
 <Card className="p-3">
 <div className="flex flex-wrap items-start justify-between gap-2">
 <div className="min-w-0 flex-1 space-y-1">
 <p className="text-sm font-medium">{j.title}</p>
 <div className="flex flex-wrap gap-1">
 <Badge variant="outline" className="text-[10px]">
 {j.court}
 </Badge>
 <Badge variant="outline" className="text-[10px]" aria-describedby={`jvs-${j.id}`}>
 {verificationLabel(j.verificationStatus)}
 </Badge>
 <span id={`jvs-${j.id}`} className="sr-only">
 Status: {verificationLabel(j.verificationStatus)}
 </span>
 </div>
 {!j.processNumber || !j.sourceUrl ? (
 <p className="flex items-center gap-1 text-xs text-amber-200">
 <AlertTriangle className="size-3 shrink-0" aria-hidden />
 {USER_FACING_MESSAGES.JURISPRUDENCE_CONFIRM}
 </p>
 ) : null}
 <p className="text-xs text-muted-foreground">{j.summary}</p>
 </div>
 <div className="flex shrink-0 flex-col gap-1">
 <Button
 type="button"
 size="sm"
 variant="secondary"
 onClick={() => void pinJurisprudence(j)}
 >
 <Pin className="mr-1 size-3" aria-hidden />
 Fixar julgado
 </Button>
 <Button type="button" size="sm" variant="ghost" onClick={() => void goToStrategy()}>
 Abrir estratégia
 </Button>
 </div>
 </div>
 </Card>
 </li>
 ))}
 </ul>
 </div>
 ) : null}

 {reco.missingInformation?.length ? (
 <Card className="border-amber-500/30 bg-amber-500/5 p-4">
 <p className="text-xs font-semibold uppercase tracking-wide text-amber-200">
 Lacunas antes de gerar peça
 </p>
 <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-amber-100/90">
 {reco.missingInformation.map((m) => (
 <li key={m}>{m}</li>
 ))}
 </ul>
 </Card>
 ) : null}
 </div>
 ) : (
 <Card className="border-dashed p-4 text-sm text-muted-foreground">
 <p>
 Não há sugestões automáticas para exibir ainda. Enriqueça o relato ou os dados do
 caso e use a busca abaixo para fixar fundamentos manualmente quando precisar.
 </p>
 </Card>
 )}
 </div>
 </section>

 <section className="space-y-3">
 <div className="flex flex-wrap items-center justify-between gap-2">
 <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
 Fundamentos fixados no caso · {legalSources.length}
 </h3>
 </div>

 {error ? (
 <Card role="alert" className="border-rose-500/30 bg-rose-500/5 p-3 text-xs text-rose-200">
 {error}
 </Card>
 ) : null}

 <p className="text-[11px] text-muted-foreground">{USER_FACING_MESSAGES.FOUNDATION_REQUIRES_PIN}</p>

 {legalSources.length === 0 ? (
 <Card className="p-6 text-center">
 <BookMarked className="mx-auto mb-2 size-6 text-muted-foreground" aria-hidden />
 <p className="text-sm text-muted-foreground">Nenhum fundamento fixado no caso ainda.</p>
 <p className="mt-1 text-xs text-muted-foreground">
 Use a busca abaixo e confirme os trechos relevantes para a peça.
 </p>
 </Card>
 ) : (
 <ul className="space-y-2">
 {legalSources.map((s) => (
 <li key={s.id}>
 <Card className="p-3">
 <div className="flex flex-wrap items-start justify-between gap-2">
 <div className="min-w-0 flex-1 space-y-1">
 <div className="flex flex-wrap gap-1">
 {s.articleRef ? (
 <Badge variant="outline" className="text-[10px]">
 {s.articleRef}
 </Badge>
 ) : null}
 {s.normUrn ? (
 <Badge variant="outline" className="font-mono text-[10px]">
 {s.normUrn}
 </Badge>
 ) : null}
 </div>
 <p className="text-sm leading-relaxed">{s.excerpt}</p>
 {s.query ? (
 <p className="text-[11px] text-muted-foreground">Pesquisa: &quot;{s.query}&quot;</p>
 ) : null}
 </div>
 <div className="flex shrink-0 items-center gap-1">
 <CaseDataOriginButton
 kind="legalSource"
 metadataJson={{
 origin: "Fundamento fixado a partir da pesquisa jurídica",
 source: s.query ? `Busca: "${s.query}"` : "Trecho indexado no acervo oficial (referência interna)",
 sourceText: s.excerpt,
 lastEditedAt: s.createdAt.toISOString(),
 lastEditedById: s.pinnedById ?? undefined,
 }}
 createdAt={s.createdAt}
 actorUserId={s.pinnedById}
 />
 <Button
 variant="ghost"
 size="sm"
 aria-label="Remover fundamento do caso"
 disabled={busy === s.id}
 onClick={() => unpin(s.id)}
 >
 <Trash2 className="size-3" aria-hidden />
 </Button>
 <Button variant="ghost" size="sm" aria-label="Copiar trecho" onClick={() => void navigator.clipboard.writeText(s.excerpt)}>
 <ClipboardCopy className="size-3" aria-hidden />
 </Button>
 </div>
 </div>
 </Card>
 </li>
 ))}
 </ul>
 )}
 </section>

 <section className="space-y-3 border-t border-border pt-4">
 <div className="flex flex-wrap items-center justify-between gap-2">
 <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
 <Search className="size-3" aria-hidden /> Buscar no acervo e na biblioteca
 </div>
 <Button asChild size="sm" variant="ghost" className="text-[11px] text-muted-foreground">
 <Link href={`/cases/${caseId}/pesquisa-juridica`}>
 Abrir pesquisa em tela cheia <ArrowRight className="ml-1 size-3" aria-hidden />
 </Link>
 </Button>
 </div>
 <LegalSearchPanel embeddedCaseId={caseId} />
 </section>
 </div>
 );
}
