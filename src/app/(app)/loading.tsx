import { Skeleton } from "@/components/ui/skeleton";

/** Mostrado durante navegação dentro de `(app)` enquanto o RSC da nova rota chega. */
export default function AppLoading() {
  return (
    <div className="lex-page-shell">
      <div className="lex-page-inner">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-9 w-48 max-w-full rounded-lg md:h-10 md:w-56" />
            <Skeleton className="h-4 w-full max-w-2xl rounded-md" />
            <Skeleton className="h-4 w-[80%] max-w-xl rounded-md" />
          </div>
          <Skeleton className="h-11 w-40 shrink-0 rounded-2xl" />
        </div>
        <div className="lex-glass-card rounded-2xl p-4 md:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Skeleton className="h-11 min-h-[44px] flex-1 rounded-lg" />
            <Skeleton className="h-11 w-28 rounded-lg" />
            <Skeleton className="h-11 w-36 rounded-lg" />
          </div>
        </div>
        <div className="space-y-5">
          <Skeleton className="h-36 w-full rounded-2xl" />
          <Skeleton className="h-36 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
