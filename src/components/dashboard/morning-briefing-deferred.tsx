import {
  fetchMorningBriefingAggRows,
  loadMorningBriefingDeferredPayload,
  type MorningBriefingRequestArgs,
} from "@/lib/dashboard/morning-briefing-data";
import { devLogLexTiming } from "@/lib/dev/server-timing";
import { MorningBriefingMainWithData } from "@/components/dashboard/morning-briefing";

export function MorningBriefingBodySkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="A carregar briefing">
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="lex-glass-card min-h-[220px] animate-pulse rounded-2xl bg-[color:var(--surface-overlay)]/50"
          />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="lex-glass-card h-64 animate-pulse rounded-2xl bg-[color:var(--surface-overlay)]/50" />
        <div className="hidden min-h-64 animate-pulse rounded-2xl bg-[color:var(--surface-overlay)]/50 lg:block" />
      </div>
    </div>
  );
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
