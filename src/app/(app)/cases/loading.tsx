import { Skeleton } from "@/components/ui/skeleton";
import { lexRouteSkeletonPanelClassName } from "@/lib/lex-ds";
import { cn } from "@/lib/utils";

export default function CasesLoading() {
  return (
    <>
      <div className={cn(lexRouteSkeletonPanelClassName, "p-4 md:p-5")}>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Skeleton className="h-11 min-h-[44px] w-full rounded-lg sm:min-w-[320px] sm:flex-1 md:max-w-xl" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-11 w-24 rounded-lg" />
            <Skeleton className="h-11 w-40 rounded-lg" />
            <Skeleton className="h-11 w-36 shrink-0 rounded-2xl" />
          </div>
        </div>
      </div>

      <div className="hidden items-start gap-6 md:flex">
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <CaseCardSkeleton key={`l-${i}`} />
          ))}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <CaseCardSkeleton key={`r-${i}`} />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-5 md:hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <CaseCardSkeleton key={`m-${i}`} />
        ))}
      </div>
    </>
  );
}

function CaseCardSkeleton() {
  return (
    <article className={cn(lexRouteSkeletonPanelClassName, "relative flex flex-col overflow-hidden p-4 md:p-5")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-6 w-24 rounded-md" />
            <Skeleton className="h-4 w-32 rounded-md" />
          </div>
          <Skeleton className="h-6 w-full rounded-md" />
          <Skeleton className="h-4 w-full rounded-md" />
        </div>
        <Skeleton className="size-9 shrink-0 rounded-lg" />
      </div>
      <div className="mt-3 space-y-2 border-t border-[color:var(--border-subtle)] pt-3">
        <Skeleton className="h-4 w-full rounded-md" />
        <Skeleton className="h-3 w-48 rounded-md" />
      </div>
    </article>
  );
}
