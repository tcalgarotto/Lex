import { LANDING_CONTAINER, LANDING_TRUST_STRIP } from "@/lib/marketing/landing-copy";

export function LandingTrustStrip() {
  return (
    <div className="w-full border-y border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay)]/40 backdrop-blur-sm">
      <div className={`${LANDING_CONTAINER} py-4 md:py-5`}>
        <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:gap-x-8">
          {LANDING_TRUST_STRIP.map((label) => (
            <li
              key={label}
              className="text-center text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-muted)] sm:text-[12px]"
            >
              {label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
