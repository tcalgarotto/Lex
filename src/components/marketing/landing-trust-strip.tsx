import { LANDING_CONTENT, LANDING_TRUST_STRIP } from "@/lib/marketing/landing-copy";

export function LandingTrustStrip() {
  return (
    <div className="w-full border-y border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay)]/60 backdrop-blur-md">
      <div className={`${LANDING_CONTENT} py-4 md:py-5`}>
        <ul className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
          {LANDING_TRUST_STRIP.map((label) => (
            <li
              key={label}
              className="rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]/70 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--text-muted)] sm:text-[11px]"
            >
              {label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
