import { Skeleton } from "@/components/ui/skeleton";
import { lexRouteSkeletonSurfaceClassName } from "@/lib/lex-ds";
import { cn } from "@/lib/utils";

/** Conteúdo da aba ativa enquanto a página do caso carrega (cabeçalho vem do layout). */
export default function CaseDetailPageLoading() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-3 w-24 rounded-md" />
        <Skeleton className="h-4 w-full max-w-2xl rounded-md" />
      </div>

      <div className={cn(lexRouteSkeletonSurfaceClassName, "space-y-4 rounded-xl p-4 md:p-5")}>
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-8 w-full max-w-md rounded-lg" />
          <Skeleton className="h-8 flex-1 rounded-lg md:max-w-xs" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    </div>
  );
}
