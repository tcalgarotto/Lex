"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useUiStore } from "@/stores/ui-store";

import type { SearchHit } from "@/types/search";

export function CommandMenu() {
  const router = useRouter();
  const open = useUiStore((s) => s.commandOpen);
  const setOpen = useUiStore((s) => s.setCommandOpen);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);

  const runSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setHits([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=12`);
      const data = (await res.json()) as { hits: SearchHit[] };
      setHits(data.hits ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void runSearch(q), 200);
    return () => clearTimeout(t);
  }, [q, runSearch]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || e.key === "/") {
        if ((e.target as HTMLElement)?.closest?.("input,textarea,[contenteditable]")) return;
        e.preventDefault();
        setOpen(!open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, setOpen]);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Buscar processos, documentos, peças…"
        value={q}
        onValueChange={setQ}
      />
      <CommandList>
        <CommandEmpty>{loading ? "Buscando…" : q.length < 2 ? "Digite 2+ caracteres" : "Nada encontrado."}</CommandEmpty>
        <CommandGroup heading="Resultados">
          {hits.map((h) => (
            <CommandItem
              key={`${h.type}-${h.id}`}
              onSelect={() => {
                setOpen(false);
                router.push(h.href);
              }}
            >
              <span className="truncate font-medium">{h.title}</span>
              <span className="ml-2 text-xs text-muted-foreground">{h.type}</span>
              {h.subtitle ? (
                <span className="block truncate text-xs text-zinc-500">{h.subtitle}</span>
              ) : null}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
