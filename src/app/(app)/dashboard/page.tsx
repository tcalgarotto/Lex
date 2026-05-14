import { Suspense } from "react";
import { MembershipRole } from "@prisma/client";
import { getWorkspaceContextWithRole } from "@/lib/auth/session";
import { hasAtLeast } from "@/lib/auth/permissions";
import {
  activeCaseWhereFor,
  fetchMorningBriefingAggRows,
  lawyerHonorificFromMetadata,
  mapMorningBriefingAggToShellProps,
  type MorningBriefingRequestArgs,
} from "@/lib/dashboard/morning-briefing-data";
import { MorningBriefingHeaderShell } from "@/components/dashboard/morning-briefing";
import { getProcessAnalytics } from "@/lib/legal-processes/process-analytics";
import { Card, CardContent } from "@/components/ui/card";
import {
  MorningBriefingBodySkeleton,
  MorningBriefingDeferred,
} from "@/components/dashboard/morning-briefing-deferred";
import { DashboardCalendarCards } from "@/components/calendar/dashboard-calendar-cards";
import { devLogLexTiming } from "@/lib/dev/server-timing";

function displayNameHintFromUserMetadata(meta: unknown): string | null {
  if (!meta || typeof meta !== "object") return null;
  const m = meta as Record<string, unknown>;
  for (const key of ["full_name", "name", "given_name"] as const) {
    const v = m[key];
    if (typeof v === "string") {
      const t = v.trim();
      if (t.length > 0) return t;
    }
  }
  return null;
}

/**
 * Briefing — shell rápido (hero + CTAs) e corpo pesado em Suspense.
 */
export default async function DashboardPage() {
  const pageT0 = performance.now();
  const tWs = performance.now();
  const { user, workspaceId, role } = await getWorkspaceContextWithRole();
  devLogLexTiming("dashboard.getWorkspaceContextWithRole", performance.now() - tWs);

  const briefingArgs: MorningBriefingRequestArgs = {
    workspaceId,
    userId: user.id,
    userEmail: user.email ?? "",
    isAdmin: role != null && hasAtLeast(role, MembershipRole.ADMIN),
    displayNameHint: displayNameHintFromUserMetadata(user.user_metadata),
    honorific: lawyerHonorificFromMetadata(user.user_metadata),
  };

  const tAgg = performance.now();
  const agg = await fetchMorningBriefingAggRows(briefingArgs, activeCaseWhereFor(workspaceId));
  devLogLexTiming("dashboard.briefingAggRows", performance.now() - tAgg);

  const [shell, processAnalytics] = await Promise.all([
    Promise.resolve(mapMorningBriefingAggToShellProps(briefingArgs, agg)),
    getProcessAnalytics(workspaceId),
  ]);
  devLogLexTiming("dashboard.pageShell", performance.now() - pageT0);

  const processMetricsTrailing = (
    <div className="grid w-[320px] max-w-full grid-cols-3 gap-2 ms-auto">
      <Card className="min-w-0 border-border/60 shadow-sm">
        <CardContent className="flex min-w-0 flex-col gap-0.5 p-2 px-1.5 sm:px-2">
          <p
            className="truncate text-center text-caption font-medium leading-tight text-muted-foreground"
            title="processos"
          >
            processos
          </p>
          <p className="text-center text-xl font-semibold tabular-nums leading-none">{processAnalytics.total}</p>
        </CardContent>
      </Card>
      <Card className="min-w-0 border-border/60 shadow-sm">
        <CardContent className="flex min-w-0 flex-col gap-0.5 p-2 px-1.5 sm:px-2">
          <p
            className="truncate text-center text-caption font-medium leading-tight text-muted-foreground"
            title="movimentações"
          >
            movimentações
          </p>
          <p className="text-center text-xl font-semibold tabular-nums leading-none">
            {processAnalytics.recentMovements}
          </p>
        </CardContent>
      </Card>
      <Card className="min-w-0 border-border/60 shadow-sm">
        <CardContent className="flex min-w-0 flex-col gap-0.5 p-2 px-1.5 sm:px-2">
          <p
            className="truncate text-center text-caption font-medium leading-tight text-muted-foreground"
            title="alertas"
          >
            alertas
          </p>
          <p className="text-center text-xl font-semibold tabular-nums leading-none">{processAnalytics.openAlerts}</p>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <>
        <div className="col-span-full xl:col-span-4">
          <MorningBriefingHeaderShell
            displayName={shell.displayName}
            hasNoCases={shell.hasNoCases}
            honorific={shell.honorific}
            headerTrailing={processMetricsTrailing}
          />
        </div>
        {shell.hasNoCases ? null : (
          <div className="col-span-full xl:col-span-4">
            <Suspense fallback={<MorningBriefingBodySkeleton />}>
              <MorningBriefingDeferred briefingArgs={briefingArgs} agg={agg} />
            </Suspense>
          </div>
        )}
        <DashboardCalendarCards workspaceId={workspaceId} />
    </>
  );
}
