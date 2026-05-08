"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SearchHit, SearchResponse } from "@/types/search";

type Scope = "tudo" | "casos" | "documentos" | "peças" | "legislação";

const SCOPES: Scope[] = ["tudo", "casos", "documentos", "peças", "legislação"];

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; hits: SearchHit[]; hadOfficial: boolean }
  | { kind: "empty" }
  | { kind: "error"; message: string };

export default function BuscaPage() {
  const [q, setQ] = useState("");
  const [scope, setScope] = useState<Scope>("tudo");
  const [state, setState] = useState<State>({ kind: "idle" });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<SearchHit | null>(null);

  const run = useCallback(async () => {
    if (q.trim().length < 2) return;
    setState({ kind: "loading" });
    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(q)}&scope=${scope}&limit=30`,
      );
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new Error(detail || `HTTP ${res.status}`);
      }
      const data = (await res.json()) as SearchResponse & {
        hadOfficialCorpus?: boolean;
      };
      const hits = data.hits ?? [];
      if (hits.length === 0) {
        setState({ kind: "empty" });
      } else {
        setState({
          kind: "ok",
          hits,
          hadOfficial: Boolean(data.hadOfficialCorpus),
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setState({ kind: "error", message: msg });
      toast.error("Não foi possível buscar agora");
    }
  }, [q, scope]);

  const openDetail = (h: SearchHit) => {
    if (!h.excerpt && !h.sourceUrl) return;
    setActive(h);
    setOpen(true);
  };

  const copyCitation = async () => {
    if (!active) return;
    const parts = [
      active.identifier ?? active.title,
      active.fullPath ?? active.articleRef,
      active.sourceUrl,
    ].filter(Boolean);
    const txt = parts.join(" — ");
    try {
      await navigator.clipboard.writeText(txt);
      toast.success("Citação copiada");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <AppShell title="Busca">
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold">Busca</h1>
          <p className="text-sm text-muted-foreground">
            Pesquise casos, documentos, peças ou legislação no escritório.
          </p>
        </header>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run();
          }}
        >
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ex.: caso João vs Maria, art. 5º LV, contrato de locação…"
          />
          <Button
            onClick={() => void run()}
            disabled={state.kind === "loading" || q.trim().length < 2}
          >
            {state.kind === "loading" ? (
              <Loader2 className="mr-1 size-4 animate-spin" />
            ) : (
              <Search className="mr-1 size-4" />
            )}
            Buscar
          </Button>
        </form>

        <ScopeBar value={scope} onChange={setScope} />

        <Body
          state={state}
          q={q}
          onOpen={openDetail}
        />
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{active?.title}</DialogTitle>
            {active?.subtitle ? (
              <p className="text-xs text-muted-foreground">{active.subtitle}</p>
            ) : null}
          </DialogHeader>
          <div className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-md border border-white/10 bg-zinc-900/50 p-3 text-sm text-zinc-200">
            {active?.excerpt ?? "Sem trecho disponível."}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {active?.sourceUrl ? (
              <a
                href={active.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-violet-300 underline"
              >
                Abrir fonte oficial
              </a>
            ) : null}
            {active?.normUrn ? (
              <code className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
                {active.normUrn}
              </code>
            ) : null}
            {active?.provider ? (
              <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
                {active.provider}
              </span>
            ) : null}
            <div className="ml-auto">
              <Button size="sm" variant="secondary" onClick={() => void copyCitation()}>
                Copiar citação
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function ScopeBar({ value, onChange }: { value: Scope; onChange: (s: Scope) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {SCOPES.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          className={`rounded-md border px-2 py-1 text-xs capitalize ${
            s === value
              ? "border-violet-500/40 bg-violet-500/10 text-violet-200"
              : "border-white/10 hover:bg-white/5"
          }`}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

function Body({
  state,
  q,
  onOpen,
}: {
  state: State;
  q: string;
  onOpen: (h: SearchHit) => void;
}) {
  if (state.kind === "idle") {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        Pesquise casos, documentos, peças ou legislação para começar.
      </Card>
    );
  }
  if (state.kind === "loading") {
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} className="h-16 animate-pulse" />
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
      <Card className="p-6 text-center text-sm">
        <p>
          Nenhum resultado para <span className="font-medium">&quot;{q}&quot;</span>.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Tente outro termo ou filtre por <strong>Legislação</strong>.
        </p>
      </Card>
    );
  }

  return (
    <>
      {!state.hadOfficial &&
      state.hits.every((h) => h.type !== "lei" && h.type !== "jurisprudência") ? (
        <Card className="border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200">
          <AlertTriangle className="mr-1 inline size-3" />
          Corpus jurídico oficial não retornou resultados para esta busca. Tente filtrar por
          &quot;Legislação&quot; ou simplificar a query.
        </Card>
      ) : null}
      <ul className="space-y-2">
        {state.hits.map((h) => (
          <ResultItem key={`${h.type}-${h.id}`} h={h} onOpen={onOpen} />
        ))}
      </ul>
    </>
  );
}

function ResultItem({ h, onOpen }: { h: SearchHit; onOpen: (h: SearchHit) => void }) {
  const inner = (
    <Card className="p-3 hover:bg-white/5">
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium">{h.title}</span>
        <Badge variant="outline" className="shrink-0 text-[10px] capitalize">
          {h.type}
        </Badge>
      </div>
      {h.subtitle ? (
        <p className="mt-0.5 text-xs text-muted-foreground">{h.subtitle}</p>
      ) : null}
      {h.excerpt ? (
        <p className="mt-1 line-clamp-2 text-xs text-zinc-400">{h.excerpt}</p>
      ) : null}
      {typeof h.score === "number" ? (
        <p className="mt-0.5 text-[10px] text-zinc-500">
          relevância {Math.round(h.score * 100)}%
        </p>
      ) : null}
    </Card>
  );

  if (h.href) {
    return (
      <li>
        <Link href={h.href} className="block">
          {inner}
        </Link>
      </li>
    );
  }
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(h)}
        disabled={!h.excerpt}
        className="block w-full text-left"
      >
        {inner}
      </button>
    </li>
  );
}
