import { cn } from "@/lib/utils";
import {
  formatBytesHumanIec,
  formatWorkspaceStorageUsageLine,
  STORAGE_BLOCKED_MESSAGE,
  STORAGE_NEAR_LIMIT_MESSAGE,
  STORAGE_UPGRADE_SOON_MESSAGE,
  type WorkspaceStorageSummary,
} from "@/lib/storage/storage-quota";

function toneBarClass(tone: WorkspaceStorageSummary["tone"]): string {
  switch (tone) {
    case "warn":
      return "bg-amber-500";
    case "strong":
    case "full":
      return "bg-rose-500";
    default:
      return "bg-emerald-500";
  }
}

function toneHint(summary: WorkspaceStorageSummary): string | null {
  if (summary.tone === "full") return STORAGE_BLOCKED_MESSAGE;
  if (summary.tone === "strong" || summary.tone === "warn") return STORAGE_NEAR_LIMIT_MESSAGE;
  return null;
}

export function WorkspaceStorageIndicator({ summary }: { summary: WorkspaceStorageSummary }) {
  const pct = Math.min(100, Math.max(0, summary.percentUsed));
  const usedLabel = formatBytesHumanIec(summary.usedBytes);
  const quotaLabel = formatBytesHumanIec(summary.quotaBytes);
  const hint = toneHint(summary);

  return (
    <div
      className="lex-glass-card space-y-3 rounded-2xl border border-[color:var(--border-subtle)] p-4 md:p-5"
      role="region"
      aria-label="Armazenamento do workspace"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-[color:var(--text-primary)]">Armazenamento</h2>
        <p className="text-[13px] text-[color:var(--text-muted)]">
          {usedLabel} de {quotaLabel}
        </p>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
      >
        <div className={cn("h-full rounded-full transition-all", toneBarClass(summary.tone))} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[13px] leading-relaxed text-[color:var(--text-secondary)]">
        {formatWorkspaceStorageUsageLine(summary)}
      </p>
      {hint ? (
        <p
          className={cn(
            "text-[13px] leading-relaxed",
            summary.tone === "full" ? "text-rose-200" : "text-amber-100",
          )}
        >
          {hint}
        </p>
      ) : null}
      <p className="text-[12px] text-[color:var(--text-muted)]">
        {formatBytesHumanIec(summary.quotaBytes)} incluídos no plano atual. {STORAGE_UPGRADE_SOON_MESSAGE} Libere
        espaço excluindo documentos antigos.
      </p>
    </div>
  );
}
