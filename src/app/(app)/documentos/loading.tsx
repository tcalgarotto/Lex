import { Skeleton } from "@/components/ui/skeleton";
import { lexRouteSkeletonPanelClassName } from "@/lib/lex-ds";
import { cn } from "@/lib/utils";

export default function DocumentosLoading() {
  return (
    <>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-9 w-44 rounded-lg md:h-10 md:w-52" />
          <Skeleton className="h-4 w-full max-w-2xl rounded-md" />
          <Skeleton className="h-4 w-[78%] max-w-xl rounded-md" />
        </div>
        <Skeleton className="h-11 w-44 shrink-0 rounded-2xl" />
      </header>

      <div className={cn(lexRouteSkeletonPanelClassName, "p-4 md:p-5")}>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-11 min-h-[44px] w-28 rounded-2xl" />
          ))}
        </div>
      </div>

      <ul className="flex flex-col gap-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <li key={i}>
            <article className={cn(lexRouteSkeletonPanelClassName, "relative flex flex-col overflow-hidden p-4 md:p-5")}>
              <div className="flex gap-4 md:gap-5">
                <div className="shrink-0 w-[4.5rem] sm:w-24">
                  <Skeleton className="aspect-[3/4] w-full rounded-xl" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Skeleton className="h-5 w-28 rounded-md" />
                        <Skeleton className="h-4 w-36 rounded-md" />
                      </div>
                      <Skeleton className="h-6 w-full rounded-md" />
                    </div>
                    <Skeleton className="h-9 w-24 shrink-0 rounded-md" />
                  </div>
                </div>
              </div>
              <div className="mt-3 border-t border-[color:var(--border-subtle)] pt-3">
                <Skeleton className="h-4 w-64 rounded-md" />
              </div>
            </article>
          </li>
        ))}
      </ul>
    </>
  );
}
