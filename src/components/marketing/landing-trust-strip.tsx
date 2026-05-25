import { LANDING_CONTENT, LANDING_TRUST_STRIP } from "@/lib/marketing/landing-copy";

export function LandingTrustStrip() {
  return (
    <div className="w-full border-y border-[color:var(--border-subtle)]">
      <ul
        className={`${LANDING_CONTENT} landing-trust-strip-list flex max-w-3xl flex-wrap items-center justify-center gap-x-3 gap-y-2 py-4 md:mx-auto md:max-w-2xl md:py-5`}
      >
        {LANDING_TRUST_STRIP.map((label) => (
          <li
            key={label}
            className="max-w-[14rem] text-center text-micro font-medium leading-snug text-[color:var(--text-muted)] sm:max-w-none sm:text-caption"
          >
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}
