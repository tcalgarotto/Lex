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
import { prefetchOnce } from "@/lib/navigation/prefetch-routes";

import type { SearchHit } from "@/types/search";

export function CommandMenu() {
  const router = useRouter();
  const open = useUiStore((s) => s.commandOpen);
  const setOpen = useUiStore((s) => s.setCommandOpen);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (!next) {
        setQ("");
        setHits([]);
        setLoading(false);
      }
    },
    [setOpen],
  );

  useEffect(() => {
    if (q.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const ac = new AbortController();
    const t = setTimeout(() => {
      void (async () => {
        setLoading(true);
        try {
          const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=12`, {
            signal: ac.signal,
            credentials: "same-origin",
          });
          if (!res.ok) {
            if (!cancelled) setHits([]);
            return;
          }
          const data = (await res.json()) as { hits?: SearchHit[] };
          if (!cancelled) setHits(data.hits ?? []);
        } catch (e) {
          if ((e as Error).name === "AbortError" || cancelled) return;
          setHits([]);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(t);
      ac.abort();
    };
  }, [q]);

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
    <CommandDialog open={open} onOpenChange={handleOpenChange}>
      <CommandInput
        autoFocus
        placeholder="Buscar processos, documentos, peças…"
        value={q}
        onValueChange={setQ}
      />
      <CommandList>
        <CommandEmpty>
          {loading ? "Buscando…" : q.length < 2 ? "Digite 2+ caracteres" : "Nada encontrado."}
        </CommandEmpty>
        <CommandGroup heading="Resultados">
          {hits.map((h) => {
            const href = h.href?.trim();
            const itemValue = `${h.type}:${h.id}`;
            return (
              <CommandItem
                key={itemValue}
                value={itemValue}
                disabled={!href}
                keywords={[h.title, h.subtitle ?? "", h.type].filter(Boolean)}
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                onSelect={() => {
                  if (!href) return;
                  handleOpenChange(false);
                  router.push(href);
                }}
                onMouseEnter={() => {
                  if (href) prefetchOnce(router, href);
                }}
              >
                <span className="truncate font-medium">{h.title}</span>
                <span className="ml-2 text-xs text-muted-foreground">{h.type}</span>
                {h.subtitle ? (
                  <span className="block truncate text-xs text-[color:var(--text-muted)]">{h.subtitle}</span>
                ) : null}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
