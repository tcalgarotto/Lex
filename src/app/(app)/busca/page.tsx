"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { SearchHit } from "@/types/search";

export default function BuscaPage() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=30`);
      const data = (await res.json()) as { hits: SearchHit[] };
      setHits(data.hits ?? []);
    } finally {
      setLoading(false);
    }
  }, [q]);

  return (
    <AppShell title="Busca global">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Processos, peças, legislação…"
            onKeyDown={(e) => e.key === "Enter" && void run()}
          />
          <Button onClick={() => void run()} disabled={loading}>
            {loading ? "…" : "Buscar"}
          </Button>
        </div>
        <ul className="space-y-2">
          {hits.map((h) => (
            <li key={`${h.type}-${h.id}`}>
              <Link
                href={h.href}
                className="block rounded-lg border border-white/10 bg-zinc-900/40 px-4 py-3 hover:bg-white/5"
              >
                <span className="text-sm font-medium">{h.title}</span>
                <span className="ml-2 text-xs text-violet-400">{h.type}</span>
                {h.subtitle ? (
                  <p className="text-xs text-muted-foreground">{h.subtitle}</p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}
