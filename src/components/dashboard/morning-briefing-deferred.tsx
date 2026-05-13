import {
  fetchMorningBriefingAggRows,
  loadMorningBriefingDeferredPayload,
  type MorningBriefingRequestArgs,
} from "@/lib/dashboard/morning-briefing-data";
import { devLogLexTiming } from "@/lib/dev/server-timing";
import { MorningBriefingMainWithData } from "@/components/dashboard/morning-briefing";
import { DashboardBriefingBodySkeleton } from "@/components/dashboard/dashboard-briefing-skeleton";

/** Mesmo layout que `dashboard/loading` após cabeçalho e métricas — evita “dois” esqueletos diferentes. */
export function MorningBriefingBodySkeleton() {
  return <DashboardBriefingBodySkeleton />;
}

export async function MorningBriefingDeferred({
  briefingArgs,
  agg,
}: {
  briefingArgs: MorningBriefingRequestArgs;
  agg: Awaited<ReturnType<typeof fetchMorningBriefingAggRows>>;
}) {
  const t0 = performance.now();
  const data = await loadMorningBriefingDeferredPayload(briefingArgs, agg);
  devLogLexTiming("dashboard.briefingHeavyPipeline", performance.now() - t0);
  return <MorningBriefingMainWithData data={data} />;
}
