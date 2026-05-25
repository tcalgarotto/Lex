import { cn } from "@/lib/utils";
import type { LandingProductJourney } from "@/lib/marketing/landing-copy";

type LandingJourneyPanelProps = {
  snippet: LandingProductJourney["snippet"];
  className?: string;
};

/** Snippet estático de produto (decorativo) para jornadas em /produto. */
export function LandingJourneyPanel({ snippet, className }: LandingJourneyPanelProps) {
  return (
    <div
      className={cn(
        "landing-journey-panel relative overflow-hidden rounded-2xl border border-[color:var(--border-default)] bg-[color:var(--surface-card)] shadow-[var(--shadow-md)]",
        className,
      )}
      aria-hidden
    >
      <div className="border-b border-[color:var(--border-subtle)] px-4 py-2.5">
        <p className="truncate text-caption font-medium text-[color:var(--text-muted)]">{snippet.chrome}</p>
      </div>
      <div className="space-y-3 p-4 md:p-5">
        <p className="text-micro font-semibold uppercase tracking-wide text-[color:var(--brand-text)]">
          {snippet.headline}
        </p>
        <ul className="space-y-2">
          {snippet.lines.map((line) => (
            <li
              key={line}
              className="rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-elevated)] px-3 py-2 text-caption text-[color:var(--text-secondary)]"
            >
              {line}
            </li>
          ))}
        </ul>
        {snippet.footer ? (
          <p className="border-t border-[color:var(--border-subtle)] pt-3 text-caption font-medium text-[color:var(--text-muted)]">
            {snippet.footer}
          </p>
        ) : null}
      </div>
    </div>
  );
}
