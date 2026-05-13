import { Skeleton } from "@/components/ui/skeleton";
import { lexRouteSkeletonPanelClassName } from "@/lib/lex-ds";
import { cn } from "@/lib/utils";

/**
 * Silhueta do bloco renderizado por `MorningBriefingMainWithData` (urgente opcional omitido).
 * Usada no `Suspense` do dashboard e reutilizada em `dashboard/loading.tsx` para evitar dois layouts diferentes.
 */
export function DashboardBriefingBodySkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="A carregar briefing">
      <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:grid-rows-[auto_1fr] lg:items-stretch lg:gap-5">
        <div className="min-w-0 lg:col-start-1 lg:row-start-1">
          <div className="grid items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className={cn(lexRouteSkeletonPanelClassName, "flex h-full min-h-[168px] flex-col px-4 py-3 md:px-5")}
              >
                <Skeleton className="h-3 w-28 rounded-md" />
                <Skeleton className="mt-3 h-5 w-full rounded-md" />
                <div className="mt-3 space-y-2">
                  <Skeleton className="h-3 w-full rounded-md" />
                  <Skeleton className="h-3 w-[92%] rounded-md" />
                  <Skeleton className="h-3 w-[80%] rounded-md" />
                </div>
                <div className="mt-auto space-y-2 pt-4">
                  <Skeleton className="h-1 w-full rounded-sm" />
                  <Skeleton className="h-3 w-24 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-5 lg:col-start-1 lg:row-start-2 lg:min-h-0">
          <div className={cn(lexRouteSkeletonPanelClassName, "overflow-hidden")}>
            <div className="flex items-center gap-2 border-b border-[color:var(--border-subtle)] px-[18px] py-3.5">
              <Skeleton className="size-4 rounded-md" />
              <Skeleton className="h-4 flex-1 rounded-md" />
              <Skeleton className="h-3 w-24 rounded-md" />
            </div>
            <div className="divide-y divide-[color:var(--border-subtle)] px-[18px] py-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-2 py-4 first:pt-0 sm:flex-row sm:items-center">
                  <Skeleton className="size-8 shrink-0 rounded-[var(--r-md)]" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-full rounded-md" />
                    <Skeleton className="h-3 w-full max-w-md rounded-md" />
                  </div>
                  <Skeleton className="h-8 w-24 shrink-0 rounded-md" />
                </div>
              ))}
            </div>
          </div>

          <div className={cn(lexRouteSkeletonPanelClassName, "overflow-hidden")}>
            <div className="flex items-center gap-2 border-b border-[color:var(--border-subtle)] px-[18px] py-3.5">
              <Skeleton className="size-4 rounded-md" />
              <Skeleton className="h-4 flex-1 rounded-md" />
              <Skeleton className="h-3 w-16 rounded-md" />
            </div>
            <div className="space-y-0 px-[18px] py-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="border-b border-[color:var(--border-subtle)] py-4 last:border-0">
                  <div className="flex gap-3">
                    <Skeleton className="size-[30px] shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-4 w-[75%] rounded-md" />
                      <Skeleton className="h-3 w-full rounded-md" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={cn(lexRouteSkeletonPanelClassName, "overflow-hidden")}>
            <div className="flex items-center gap-2 border-b border-[color:var(--border-subtle)] px-[18px] py-3.5">
              <Skeleton className="size-4 rounded-md" />
              <Skeleton className="h-4 w-40 rounded-md" />
            </div>
            <div className="space-y-5 px-[18px] py-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-1 border-b border-[color:var(--border-subtle)] pb-3 last:border-0">
                  <Skeleton className="h-3 w-full rounded-md" />
                  <Skeleton className="h-3 w-24 rounded-md" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          className={cn(
            lexRouteSkeletonPanelClassName,
            "flex h-full min-h-[168px] flex-col overflow-hidden border border-violet-500/20 bg-[rgba(124,58,237,0.05)] lg:col-start-2 lg:row-start-1",
          )}
        >
          <div className="flex shrink-0 items-center gap-2 border-b border-violet-500/10 px-4 py-2.5 md:px-5">
            <Skeleton className="size-[26px] rounded-md" />
            <Skeleton className="h-4 flex-1 rounded-md" />
          </div>
          <div className="flex min-h-0 flex-1 flex-col px-[18px] py-2.5">
            <Skeleton className="h-12 w-full rounded-lg" />
            <div className="min-h-0 flex-1" aria-hidden />
          </div>
        </div>

        <aside className="flex min-w-0 flex-col gap-5 lg:col-start-2 lg:row-start-2 lg:min-h-0">
          <div className={cn(lexRouteSkeletonPanelClassName, "overflow-hidden")}>
            <div className="border-b border-[color:var(--border-subtle)] px-[18px] py-3">
              <Skeleton className="h-3 w-20 rounded-md" />
            </div>
            <div className="grid grid-cols-2 gap-2 p-[18px]">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-[var(--r-md)]" />
              ))}
            </div>
          </div>
          <div className={cn(lexRouteSkeletonPanelClassName, "overflow-hidden")}>
            <div className="border-b border-[color:var(--border-subtle)] px-[18px] py-3">
              <Skeleton className="h-3 w-16 rounded-md" />
            </div>
            <div className="grid grid-cols-2 gap-2 p-[18px]">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-[var(--r-md)]" />
              ))}
            </div>
          </div>
          <div className={cn(lexRouteSkeletonPanelClassName, "overflow-hidden")}>
            <div className="border-b border-[color:var(--border-subtle)] px-[18px] py-3">
              <Skeleton className="h-3 w-28 rounded-md" />
            </div>
            <div className="space-y-5 px-[18px] py-3">
              <div className="grid grid-cols-2 gap-2">
                <Skeleton className="h-16 w-full rounded-[var(--r-md)]" />
                <Skeleton className="h-16 w-full rounded-[var(--r-md)]" />
              </div>
              <Skeleton className="h-24 w-full rounded-md" />
            </div>
          </div>
          <div className={cn(lexRouteSkeletonPanelClassName, "overflow-hidden")}>
            <div className="flex items-start gap-2 border-b border-[color:var(--border-subtle)] px-[18px] py-3.5">
              <Skeleton className="size-[26px] shrink-0 rounded-md" />
              <Skeleton className="h-4 flex-1 rounded-md" />
            </div>
            <div className="space-y-5 px-[18px] py-3">
              <Skeleton className="h-16 w-full rounded-md" />
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
