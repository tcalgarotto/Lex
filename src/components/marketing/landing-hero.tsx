import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  LANDING_CONTAINER,
  LANDING_HERO,
  LANDING_PROOF_POINTS,
} from "@/lib/marketing/landing-copy";
import { LandingHeroMockup } from "@/components/marketing/landing-hero-mockup";
import { LandingTrustStrip } from "@/components/marketing/landing-trust-strip";

export function LandingHero() {
  return (
    <section id="inicio" className="relative w-full scroll-mt-[4.75rem] overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_70%_-10%,var(--brand-subtle),transparent_55%)]"
        aria-hidden
      />
      <div className={`relative ${LANDING_CONTAINER} pb-12 pt-8 sm:pb-16 sm:pt-10 md:pb-20 md:pt-14`}>
        <div className="grid gap-10 lg:grid-cols-[1fr_minmax(0,520px)] lg:items-center lg:gap-14 xl:gap-20">
          <div className="space-y-5 sm:space-y-6">
            <p
              className="inline-flex w-fit items-center rounded-full border border-[color:var(--brand-border)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand-text)]"
              style={{ background: "var(--brand-subtle)" }}
            >
              {LANDING_HERO.badge}
            </p>
            <h1 className="max-w-2xl font-serif text-[1.9rem] font-normal leading-[1.1] tracking-tight text-[color:var(--text-primary)] sm:text-[2.5rem] lg:text-[3.1rem] lg:leading-[1.06]">
              {LANDING_HERO.title}
            </h1>
            <p className="max-w-xl text-[15px] leading-relaxed text-[color:var(--text-secondary)] sm:text-[17px]">
              {LANDING_HERO.subtitle}
            </p>
            <p className="max-w-lg text-[13px] leading-relaxed text-[color:var(--text-muted)]">
              {LANDING_HERO.microcopy}
            </p>
            <div className="flex flex-col gap-3 pt-1 sm:flex-row">
              <Link href="#beta" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="h-12 w-full gap-2 rounded-lg border border-[color:var(--brand-border)] px-8 text-[color:var(--text-inverse)] shadow-[var(--shadow-violet)] lex-transition hover:opacity-95 sm:w-auto"
                  style={{ background: "var(--brand-primary)" }}
                >
                  {LANDING_HERO.ctaPrimary}
                  <ArrowRight className="size-4" aria-hidden />
                </Button>
              </Link>
              <Link href="#como-funciona" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 w-full rounded-lg border border-[color:var(--border-default)] bg-[color:var(--glass-bg)]/80 px-8 backdrop-blur-xl hover:bg-[color:var(--surface-overlay-strong)] sm:w-auto"
                >
                  {LANDING_HERO.ctaSecondary}
                </Button>
              </Link>
            </div>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 pt-2">
              {LANDING_PROOF_POINTS.map((point) => (
                <li
                  key={point}
                  className="flex items-center gap-2 text-[12px] font-medium text-[color:var(--text-secondary)] sm:text-[13px]"
                >
                  <span
                    className="size-1.5 shrink-0 rounded-full bg-[color:var(--brand-primary)]"
                    aria-hidden
                  />
                  {point}
                </li>
              ))}
            </ul>
          </div>
          <div className="lg:justify-self-end">
            <LandingHeroMockup />
          </div>
        </div>
      </div>
      <LandingTrustStrip />
    </section>
  );
}
