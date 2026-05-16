"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  LANDING_CONTENT,
  LANDING_HERO,
  LANDING_PROOF_POINTS,
  LANDING_SHELL_FULL,
} from "@/lib/marketing/landing-copy";
import { LandingHeroMockup } from "@/components/marketing/landing-hero-mockup";
import { LandingTrustStrip } from "@/components/marketing/landing-trust-strip";
import { LandingReveal } from "@/components/marketing/landing-reveal";

export function LandingHero() {
  const reduce = useReducedMotion();

  return (
    <section id="inicio" className={`${LANDING_SHELL_FULL} relative scroll-mt-[4.75rem] overflow-hidden`}>
      <div
        className="landing-hero-glow pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_60%_at_70%_-10%,var(--brand-subtle),transparent_55%)]"
        aria-hidden
      />
      <div className={`relative ${LANDING_CONTENT} pb-12 pt-8 sm:pb-16 sm:pt-10 md:pb-20 md:pt-14`}>
        <div className="grid gap-10 lg:grid-cols-[1fr_minmax(0,480px)] lg:items-center lg:gap-12">
          <LandingReveal className="space-y-5 sm:space-y-6">
            <p
              className="inline-flex w-fit items-center rounded-full border border-[color:var(--brand-border)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--brand-text)]"
              style={{ background: "var(--brand-subtle)" }}
            >
              {LANDING_HERO.badge}
            </p>
            <h1 className="font-serif text-[1.9rem] font-normal leading-[1.1] tracking-tight text-[color:var(--text-primary)] sm:text-[2.4rem] lg:text-[2.85rem] lg:leading-[1.06]">
              {LANDING_HERO.title}
            </h1>
            <p className="text-[15px] leading-relaxed text-[color:var(--text-secondary)] sm:text-[17px]">
              {LANDING_HERO.subtitle}
            </p>
            <p className="text-[13px] leading-relaxed text-[color:var(--text-muted)]">
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
            <ul className="flex flex-wrap gap-x-4 gap-y-2 pt-2">
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
          </LandingReveal>
          <LandingReveal delay={0.12} className="lg:justify-self-end">
            {reduce ? (
              <LandingHeroMockup />
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
              >
                <LandingHeroMockup />
              </motion.div>
            )}
          </LandingReveal>
        </div>
      </div>
      <LandingTrustStrip />
    </section>
  );
}
