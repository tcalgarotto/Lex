import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardBriefingBodySkeleton } from "@/components/dashboard/dashboard-briefing-skeleton";

/** Espelha `MorningBriefingHeaderShell` + `dashboard/page.tsx` (métricas) + corpo `MorningBriefingMainWithData`. */
export default function DashboardLoading() {
  return (
    <div className="space-y-5">
      <h1 className="sr-only">Hoje no escritório — Lex</h1>

      <header className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1">
            <Skeleton className="mt-1 h-7 w-64 max-w-full rounded-lg md:h-8 md:w-80" />
            <Skeleton className="mt-1 h-4 w-52 rounded-md" />
          </div>
          <div className="flex w-full shrink-0 flex-wrap justify-end gap-2 pt-1 sm:w-auto sm:pt-0.5">
            <div className="grid w-[320px] max-w-full grid-cols-3 gap-2 ms-auto">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="min-w-0 border-border/60 shadow-sm">
                  <CardContent className="flex min-w-0 flex-col gap-0.5 p-2 px-1.5 sm:px-2">
                    <Skeleton className="mx-auto h-3 w-14 rounded-md" />
                    <Skeleton className="mx-auto h-7 w-8 rounded-md" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </header>

      <DashboardBriefingBodySkeleton />
    </div>
  );
}
