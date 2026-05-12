import { Skeleton } from "@/components/ui/skeleton";
import { lexRouteSkeletonPanelClassName } from "@/lib/lex-ds";
import { cn } from "@/lib/utils";

/** Silhueta do briefing: saudação, CTAs, grelha de pulsos, coluna principal + copiloto (superfície sólida, sem vidro). */
export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-5">
      <header className="space-y-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-64 max-w-full rounded-lg md:h-8 md:w-80" />
          <Skeleton className="h-4 w-52 rounded-md" />
          <Skeleton className="h-4 w-full max-w-2xl rounded-md" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-11 w-44 min-w-[10rem] rounded-2xl" />
          <Skeleton className="h-11 w-36 rounded-2xl" />
          <Skeleton className="h-11 w-40 rounded-2xl" />
          <Skeleton className="h-11 w-44 rounded-2xl" />
        </div>
      </header>

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={cn(lexRouteSkeletonPanelClassName, "flex min-h-[220px] flex-col px-4 py-3.5 md:px-5 md:py-4")}
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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-4">
          <div className={cn(lexRouteSkeletonPanelClassName, "overflow-hidden")}>
            <div className="flex items-center gap-2 border-b border-[color:var(--border-subtle)] px-[18px] py-3.5">
              <Skeleton className="size-4 rounded-md" />
              <Skeleton className="h-4 flex-1 rounded-md" />
              <Skeleton className="h-3 w-24 rounded-md" />
            </div>
            <div className="divide-y divide-[color:var(--border-subtle)] px-[18px] py-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-2 py-4 first:pt-2 sm:flex-row sm:items-center">
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

          <div className={cn(lexRouteSkeletonPanelClassName, "overflow-hidden lg:hidden")}>
            <div className="border-b border-[color:var(--border-subtle)] px-4 py-3">
              <Skeleton className="h-4 w-40 rounded-md" />
            </div>
            <div className="space-y-2 p-4">
              <Skeleton className="h-16 w-full rounded-lg" />
            </div>
          </div>

          <div className={cn(lexRouteSkeletonPanelClassName, "overflow-hidden")}>
            <div className="flex items-center gap-2 border-b border-[color:var(--border-subtle)] px-[18px] py-3.5">
              <Skeleton className="size-4 rounded-md" />
              <Skeleton className="h-4 flex-1 rounded-md" />
              <Skeleton className="h-3 w-16 rounded-md" />
            </div>
            <div className="space-y-0 px-[18px] py-2">
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
            <div className="space-y-3 px-[18px] py-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-1 border-b border-[color:var(--border-subtle)] pb-3 last:border-0">
                  <Skeleton className="h-3 w-full rounded-md" />
                  <Skeleton className="h-3 w-24 rounded-md" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="hidden min-w-0 flex-col gap-4 lg:flex">
          <div className={cn(lexRouteSkeletonPanelClassName, "overflow-hidden")}>
            <div className="flex items-center gap-2 border-b border-[color:var(--border-subtle)] px-4 py-3">
              <Skeleton className="size-[26px] rounded-md" />
              <Skeleton className="h-4 flex-1 rounded-md" />
            </div>
            <div className="space-y-3 p-4">
              <Skeleton className="h-20 w-full rounded-lg" />
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-8 w-28 rounded-md" />
                <Skeleton className="h-8 w-32 rounded-md" />
              </div>
            </div>
          </div>
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
              <Skeleton className="h-3 w-24 rounded-md" />
            </div>
            <div className="grid grid-cols-2 gap-2 p-[18px]">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full rounded-[var(--r-md)]" />
              ))}
            </div>
          </div>
        </aside>
      </div>

      <div className="flex flex-col gap-4 lg:hidden">
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
      </div>
    </div>
  );
}
