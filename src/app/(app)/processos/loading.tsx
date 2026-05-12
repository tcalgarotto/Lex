import { Skeleton } from "@/components/ui/skeleton";
import { lexRouteSkeletonSurfaceClassName } from "@/lib/lex-ds";
import { cn } from "@/lib/utils";

export default function ProcessosLoading() {
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className={cn(lexRouteSkeletonSurfaceClassName, "rounded-xl p-4 md:p-5")}>
        <Skeleton className="h-5 w-48 rounded-md" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-3 w-28 rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
            </div>
          ))}
          <Skeleton className="h-10 w-40 rounded-md" />
        </div>
      </div>

      <div className="space-y-3">
        <Skeleton className="h-4 w-40 rounded-md" />
        <div className={cn(lexRouteSkeletonSurfaceClassName, "rounded-xl p-3")}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="border-b border-[color:var(--border-subtle)] py-3 last:border-0">
              <Skeleton className="h-4 w-[70%] rounded-md" />
              <Skeleton className="mt-2 h-3 w-full rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
