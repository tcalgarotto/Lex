import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DashboardBriefingBodySkeleton } from "@/components/dashboard/dashboard-briefing-skeleton";

/**
 * Espelha `dashboard/page.tsx` como filhos diretos de `LexCenterGrid` (mesmas `col-span-*`
 * que `MorningBriefingHeaderShell`, `MorningBriefingDeferred` e `DashboardCalendarCards`).
 */
export default function DashboardLoading() {
  return (
    <>
      <div className="col-span-full xl:col-span-4">
        <h1 className="sr-only">Hoje no escritório — JustOS</h1>

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
      </div>

      <div className="col-span-full xl:col-span-4">
        <DashboardBriefingBodySkeleton />
      </div>

      <Card className="col-span-full border-rose-500/20 bg-rose-500/[0.04] md:col-span-1 xl:col-span-2">
        <CardHeader className="space-y-2 pb-2">
          <Skeleton className="h-5 w-28 rounded-md" />
          <Skeleton className="h-3 w-full max-w-md rounded-md" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
        </CardContent>
      </Card>

      <Card className="col-span-full md:col-span-1 xl:col-span-2">
        <CardHeader className="space-y-2 pb-2">
          <Skeleton className="h-5 w-40 rounded-md" />
          <Skeleton className="h-3 w-full max-w-lg rounded-md" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
        </CardContent>
      </Card>

      <Card className="col-span-full xl:col-span-4">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-2">
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-5 w-48 rounded-md" />
            <Skeleton className="h-3 w-full max-w-xl rounded-md" />
          </div>
          <Skeleton className="h-9 w-36 shrink-0 rounded-md" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </CardContent>
      </Card>
    </>
  );
}
