import { Skeleton } from "@/components/ui/skeleton";

const MINI_MONTH_CELLS = 42;

/** Espelha `LexAgendaShell`: 3 colunas; barra Hoje/vistas só na coluna central. */
export default function AgendaLoading() {
  return (
    <div
      className="lex-agenda-root flex h-[calc(100svh-var(--app-header-h))] min-h-0 w-full min-w-0 flex-col overflow-hidden bg-transparent text-[color:var(--text-primary)]"
      aria-busy="true"
      aria-label="A carregar agenda"
    >
      <div className="lex-layout-three-well" data-lex-tracks="lcr">
        <aside className="flex min-h-0 min-w-0 w-full flex-col gap-3 overflow-hidden p-3">
          <Skeleton className="h-10 w-full rounded-lg" />
          <div className="rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] p-2">
            <div className="mb-1.5 flex items-center justify-between gap-0.5">
              <Skeleton className="size-7 shrink-0 rounded-md" />
              <Skeleton className="h-5 min-w-0 flex-1 rounded-md" />
              <Skeleton className="size-7 shrink-0 rounded-md" />
            </div>
            <div className="grid grid-cols-7 gap-px">
              {Array.from({ length: 7 }, (_, i) => (
                <Skeleton key={`hdr-${i}`} className="mx-auto h-3 w-6 rounded sm:w-7" />
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-px sm:gap-0.5">
              {Array.from({ length: MINI_MONTH_CELLS }, (_, i) => (
                <Skeleton key={`mini-${i}`} className="aspect-square w-full min-w-0 rounded-md sm:rounded-lg" />
              ))}
            </div>
          </div>
        </aside>

        <section className="flex min-h-0 min-w-0 flex-col overflow-hidden">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 bg-[color:var(--surface-card)]/50 py-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <Skeleton className="h-8 w-14 shrink-0 rounded-md" />
              <Skeleton className="size-8 shrink-0 rounded-md" />
              <Skeleton className="size-8 shrink-0 rounded-md" />
              <Skeleton className="h-6 min-w-[10rem] max-w-[14rem] flex-1 rounded-md" />
            </div>
            <Skeleton className="h-8 w-[min(100%,220px)] shrink-0 rounded-lg" />
          </div>
          <div className="min-h-0 flex-1 overflow-hidden py-2 md:py-3">
            <div className="flex h-full min-h-[min(55vh,420px)] flex-col overflow-hidden rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] shadow-sm">
              <div className="grid shrink-0 grid-cols-7 gap-0 border-b border-[color:var(--border-subtle)] bg-[color:var(--surface-elevated)]/40 px-1 py-2">
                {Array.from({ length: 7 }, (_, i) => (
                  <Skeleton key={`mh-${i}`} className="mx-auto h-4 w-10 rounded" />
                ))}
              </div>
              <div className="grid min-h-0 flex-1 grid-cols-7 content-start gap-1 p-2 [grid-auto-rows:minmax(2.25rem,1fr)]">
                {Array.from({ length: MINI_MONTH_CELLS }, (_, i) => (
                  <Skeleton key={`mc-${i}`} className="min-h-9 w-full rounded-lg" />
                ))}
              </div>
            </div>
          </div>
        </section>

        <aside className="flex min-h-0 min-w-0 w-full flex-col gap-3 overflow-hidden p-3">
          <div className="space-y-2 rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-elevated)]/20 p-2">
            <Skeleton className="h-3 w-28 rounded" />
            <Skeleton className="h-9 w-full rounded-md" />
            <Skeleton className="h-9 w-full rounded-md" />
            <Skeleton className="h-16 w-full rounded-md" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="h-16 w-full rounded-lg" />
            <Skeleton className="h-9 w-full rounded-md" />
            <Skeleton className="h-9 max-w-[11rem] rounded-md" />
          </div>
          <Skeleton className="h-28 w-full rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-40 rounded" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
        </aside>
      </div>
    </div>
  );
}
