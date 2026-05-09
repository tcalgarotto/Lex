"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, Loader2, AlertTriangle, Pin, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
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
  /** F3 — trecho relevante recortado pelo backend (default 320 chars). */
  snippet?: string;
  articleRef: string | null;
  hierarchy: string | null;
  score: number;
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

interface SearchResponse {
  query: string;
  scope: string;
  caseId: string | null;
  results: SearchResult[];
  total: number;
  bases: SearchBase[];
  confidence: { label: string; score: number; reason: string } | null;
  cached?: boolean;
}

type FetchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; data: SearchResponse }
  | { kind: "empty"; data: SearchResponse }
  | { kind: "error"; message: string };

function normKindLabel(r: SearchResult): string | null {
  const kind = (r.norm.kind ?? "").toLowerCase();
  if (kind.includes("constitution")) return "Constituição";
  if (r.norm.urn.includes("!adct")) return "ADCT";
  if (kind.includes("sumula")) return "Súmula";
  if (kind.includes("jurisprudence")) return "Jurisprudência";
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

  async function run(query: string) {
    if (query.trim().length < 2) return;
    setState({ kind: "loading" });
    try {
      const url = new URL("/api/retrieval/search", window.location.origin);
      url.searchParams.set("q", query);
      url.searchParams.set("scope", scope);
      if (caseId) url.searchParams.set("caseId", caseId);
      const res = await fetch(url.toString());
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(detail || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as SearchResponse;
      setState({ kind: data.results.length === 0 ? "empty" : "ok", data });
    } catch (e) {
      setState({
        kind: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  useEffect(() => {
    if (initialQ.trim().length >= 2) void run(initialQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      // F1: pin instantâneo — quando embutido em /cases/[id], o router
      // refresh garante que a aba "Fundamentos do caso" reflita a adição
      // sem reload manual.
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
        title="Pesquise legislação e fundamentos"
        description="Digite um artigo, tema ou trecho jurídico. Exemplos: devido processo legal, art. 5º LV, contraditório, ampla defesa."
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
        title="Nenhum resultado encontrado"
        description="Tente outro termo, simplifique a busca ou troque o escopo. A base disponível inclui Constituição Federal e ADCT."
      />
    );
  }

  return (
    <ul className="space-y-2">
      {state.data.results.map((r) => {
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
                  {r.snippet && r.snippet !== r.text ? (
                    <Dialog>
                      <DialogTrigger asChild>
                        <button
                          type="button"
                          className="text-[11px] text-violet-300 underline-offset-2 hover:underline"
                        >
                          Ver artigo completo
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
                        ? "No caso"
                        : isPinning
                          ? "Adicionando…"
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
  );
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
              : "border-white/10 text-muted-foreground"
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
