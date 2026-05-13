import { inngest } from "@/lib/inngest/client";
import { getEnv } from "@/lib/env";
import { syncDueDataJudProcesses } from "@/lib/legal-processes/sync-process-movements";

export const dataJudProcessDailySync = inngest.createFunction(
  {
    id: "datajud-process-daily-sync",
    retries: 2,
    throttle: { limit: 1, period: "10m" },
    concurrency: { limit: 1 },
  },
  [{ event: "lex/datajud.sync-daily" }, { cron: "0 * * * *" }],
  async ({ event, step }) => {
    const env = getEnv();
    if (!env.DATAJUD_SYNC_DAILY_ENABLED) {
      return { ok: true, skipped: true, reason: "DATAJUD_SYNC_DAILY_ENABLED=false" };
    }
    const currentHour = new Date().getUTCHours();
    if (!event.data?.workspaceId && currentHour !== env.DATAJUD_SYNC_DAILY_HOUR) {
      return { ok: true, skipped: true, reason: "Fora da hora configurada" };
    }
    const results = await step.run("sync-due-datajud-processes", () =>
      syncDueDataJudProcesses({
        workspaceId: event.data?.workspaceId,
        take: event.data?.take ?? 50,
      }),
    );
    return { ok: true, synced: results.length, results };
  },
);
