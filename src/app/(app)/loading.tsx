import { Skeleton } from "@/components/ui/skeleton";
import { lexRouteSkeletonPanelClassName } from "@/lib/lex-ds";
import { cn } from "@/lib/utils";

/** Fallback quando não existe `loading.tsx` mais específico no segmento. */
export default function AppLoading() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-9 w-48 max-w-full rounded-lg md:h-10 md:w-56" />
          <Skeleton className="h-4 w-full max-w-2xl rounded-md" />
        </div>
        <Skeleton className="h-11 w-36 shrink-0 rounded-2xl" />
      </div>
      <div className={cn(lexRouteSkeletonPanelClassName, "p-4 md:p-5")}>
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    </div>
  );
}
