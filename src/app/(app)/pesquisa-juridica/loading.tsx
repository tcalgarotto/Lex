import { Skeleton } from "@/components/ui/skeleton";
import { lexRouteSkeletonPanelClassName, lexRouteSkeletonSurfaceClassName } from "@/lib/lex-ds";
import { cn } from "@/lib/utils";

export default function PesquisaJuridicaLoading() {
  return (
    <div className="w-full min-w-0 space-y-6">
      <header className={cn(lexRouteSkeletonSurfaceClassName, "space-y-2 rounded-xl p-6")}>
        <Skeleton className="h-8 w-56 rounded-md" />
        <Skeleton className="h-4 w-full max-w-3xl rounded-md" />
        <Skeleton className="h-4 w-[92%] max-w-2xl rounded-md" />
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-lg" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-10 w-24 rounded-md" />
            <Skeleton className="h-10 w-28 rounded-md" />
            <Skeleton className="h-10 w-32 rounded-md" />
          </div>
          <div className={cn(lexRouteSkeletonPanelClassName, "space-y-3 p-4")}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2 border-b border-[color:var(--border-subtle)] pb-3 last:border-0">
                <Skeleton className="h-4 w-[72%] rounded-md" />
                <Skeleton className="h-3 w-full rounded-md" />
              </div>
            ))}
          </div>
        </div>
        <aside className="hidden min-w-0 flex-col gap-3 lg:flex">
          <div className={cn(lexRouteSkeletonPanelClassName, "p-4")}>
            <Skeleton className="h-4 w-32 rounded-md" />
            <Skeleton className="mt-3 h-32 w-full rounded-lg" />
          </div>
          <div className={cn(lexRouteSkeletonPanelClassName, "overflow-hidden p-3")} aria-hidden>
            <Skeleton className="h-36 w-full rounded-lg" />
          </div>
        </aside>
      </div>
    </div>
  );
}
