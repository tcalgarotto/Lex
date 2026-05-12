import { Suspense } from "react";
import { MembershipRole } from "@prisma/client";
import { getWorkspaceContextWithRole } from "@/lib/auth/session";
import { hasAtLeast } from "@/lib/auth/permissions";
import {
  activeCaseWhereFor,
  fetchMorningBriefingAggRows,
  mapMorningBriefingAggToShellProps,
  type MorningBriefingRequestArgs,
} from "@/lib/dashboard/morning-briefing-data";
import { MorningBriefingHeaderShell } from "@/components/dashboard/morning-briefing";
import {
  MorningBriefingBodySkeleton,
  MorningBriefingDeferred,
} from "@/components/dashboard/morning-briefing-deferred";
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
 * Briefing matinal — shell rápido (hero + CTAs) e corpo pesado em Suspense.
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
  };

  const tAgg = performance.now();
  const agg = await fetchMorningBriefingAggRows(briefingArgs, activeCaseWhereFor(workspaceId));
  devLogLexTiming("dashboard.briefingAggRows", performance.now() - tAgg);

  const shell = mapMorningBriefingAggToShellProps(briefingArgs, agg);
  devLogLexTiming("dashboard.pageShell", performance.now() - pageT0);

  return (
    <div className="space-y-5">
      <MorningBriefingHeaderShell
        displayName={shell.displayName}
        hasNoCases={shell.hasNoCases}
        daySummaryLine={shell.daySummaryLine}
        priorityContinueHref={shell.priorityContinueHref}
        oldestUnnamedCaseId={shell.oldestUnnamedCaseId}
      />
      {shell.hasNoCases ? null : (
        <Suspense fallback={<MorningBriefingBodySkeleton />}>
          <MorningBriefingDeferred briefingArgs={briefingArgs} agg={agg} />
        </Suspense>
      )}
    </div>
  );
}
