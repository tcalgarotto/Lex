"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SearchHit, SearchResponse } from "@/types/search";

export default function BuscaPage() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [hadOfficial, setHadOfficial] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<SearchHit | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=30`);
      const data = (await res.json()) as SearchResponse;
      setHits(data.hits ?? []);
      setHadOfficial(Boolean(data.hadOfficialCorpus));
      setSearched(true);
    } finally {
      setLoading(false);
    }
  }, [q]);

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

  const officialHits = hits.filter((h) => h.type === "lei" || h.type === "legislação");

  return (
    <AppShell title="Busca global">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Processos, peças, legislação (ex.: cpc, cdc art. 18)…"
            onKeyDown={(e) => e.key === "Enter" && void run()}
          />
          <Button onClick={() => void run()} disabled={loading || q.trim().length < 2}>
            {loading ? "…" : "Buscar"}
          </Button>
        </div>

        {searched && hits.length === 0 && !loading ? (
          <p className="rounded-lg border border-white/10 bg-zinc-900/40 px-4 py-6 text-center text-sm text-muted-foreground">
            Nenhum resultado para <span className="font-medium">{q}</span>.
          </p>
        ) : null}

        {searched && hits.length > 0 && officialHits.length === 0 && !hadOfficial ? (
          <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
            Corpus jurídico oficial ainda não possui resultados para esta busca.
            Os resultados abaixo vêm de processos, peças e documentos do
            workspace.
          </p>
        ) : null}

        <ul className="space-y-2">
          {hits.map((h) => {
            const clickable = Boolean(h.excerpt) || Boolean(h.href);
            const inner = (
              <div
                className={
                  "rounded-lg border border-white/10 bg-zinc-900/40 px-4 py-3 " +
                  (clickable ? "hover:bg-white/5 cursor-pointer" : "")
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="text-sm font-medium">{h.title}</span>
                  <span className="shrink-0 text-xs text-violet-400">{h.type}</span>
                </div>
                {h.subtitle ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">{h.subtitle}</p>
                ) : null}
                {h.excerpt ? (
                  <p className="mt-1 line-clamp-2 text-xs text-zinc-400">{h.excerpt}</p>
                ) : null}
                {typeof h.score === "number" ? (
                  <p className="mt-0.5 text-[10px] text-zinc-500">score {h.score.toFixed(3)}</p>
                ) : null}
              </div>
            );
            if (h.href) {
              return (
                <li key={`${h.type}-${h.id}`}>
                  <Link href={h.href} className="block">
                    {inner}
                  </Link>
                </li>
              );
            }
            return (
              <li key={`${h.type}-${h.id}`}>
                <button
                  type="button"
                  onClick={() => openDetail(h)}
                  disabled={!h.excerpt}
                  className="block w-full text-left"
                >
                  {inner}
                </button>
              </li>
            );
          })}
        </ul>
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
