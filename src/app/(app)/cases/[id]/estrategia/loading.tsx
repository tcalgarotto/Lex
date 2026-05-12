import { Skeleton } from "@/components/ui/skeleton";
import { lexRouteSkeletonSurfaceClassName } from "@/lib/lex-ds";
import { cn } from "@/lib/utils";

export default function CaseEstrategiaLoading() {
  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <Skeleton className="h-5 w-48 rounded-md" />
        <Skeleton className="h-4 w-full max-w-3xl rounded-md" />
      </header>

      <div className="grid min-h-[420px] gap-3 lg:grid-cols-[220px_minmax(0,1fr)_280px]">
        <div className={cn(lexRouteSkeletonSurfaceClassName, "hidden flex-col gap-2 rounded-xl p-3 lg:flex")}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-md" />
          ))}
        </div>
        <div className={cn(lexRouteSkeletonSurfaceClassName, "flex flex-col rounded-xl p-3")}>
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="mt-3 min-h-[280px] flex-1 rounded-lg" />
        </div>
        <div className={cn(lexRouteSkeletonSurfaceClassName, "hidden flex-col gap-2 rounded-xl p-3 xl:flex")}>
          <Skeleton className="h-4 w-32 rounded-md" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-32 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
