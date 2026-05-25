"use client";

import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
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
import { useIsClient } from "@/hooks/use-is-client";
import { LandingReveal } from "@/components/marketing/landing-reveal";

export function LandingHero() {
  const reduce = useReducedMotion();
  const isClient = useIsClient();

  return (
    <section id="inicio" className={`${LANDING_SHELL_FULL} relative scroll-mt-[4.75rem] overflow-x-clip`}>
      <div
        id="hero-scroll-marker"
        className="pointer-events-none absolute top-[4.75rem] left-0 h-px w-full"
        aria-hidden
      />
      <div className={`relative ${LANDING_CONTENT} pb-14 pt-10 sm:pb-20 sm:pt-12 md:pb-24 md:pt-16`}>
        <div className="grid gap-12 lg:items-center lg:gap-14 xl:grid-cols-[minmax(0,1fr)_minmax(0,min(100%,520px))] xl:gap-16">
          <LandingReveal className="landing-hero-copy-stack max-w-2xl space-y-5 sm:max-w-[42rem] sm:space-y-6">
            <p className="landing-hero-kicker">{LANDING_HERO.badge}</p>
            <h1 className="lex-marketing-display landing-hero-title text-[color:var(--text-primary)]">
              {LANDING_HERO.title}
            </h1>
            <p className="lex-marketing-lead max-w-[42rem]">
              {LANDING_HERO.subtitle}
            </p>
            <p className="lex-marketing-body landing-hero-copy-muted max-md:hidden">
              {LANDING_HERO.microcopy}
            </p>
            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <Link href="#beta" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="h-13 min-h-[3.25rem] w-full gap-2 rounded-xl border border-[color:var(--brand-border)] px-8 text-control text-[color:var(--text-inverse)] shadow-[var(--shadow-sm)] lex-transition hover:opacity-95 sm:w-auto"
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
                  className="h-13 min-h-[3.25rem] w-full rounded-xl border border-[color:var(--border-default)] bg-[color:var(--surface-card)] px-8 text-control hover:bg-[color:var(--surface-overlay)] sm:w-auto"
                >
                  {LANDING_HERO.ctaSecondary}
                </Button>
              </Link>
            </div>
            <ul className="landing-hero-proof-list flex w-full max-w-md flex-col gap-2 pt-3">
              {LANDING_PROOF_POINTS.slice(0, 3).map((point) => (
                <li
                  key={point}
                  className="landing-hero-proof flex w-full items-center gap-2.5 border-t border-[color:var(--border-subtle)] py-2.5 text-caption font-medium first:border-t-0 first:pt-0"
                >
                  <Check className="size-4 shrink-0 text-[color:var(--brand-text)]" aria-hidden />
                  <span className="min-w-0">{point}</span>
                </li>
              ))}
            </ul>
          </LandingReveal>
          <LandingReveal delay={0.12} className="relative min-w-0 lg:justify-self-end">
            {isClient && !reduce ? (
              <motion.div
                className="relative z-[1]"
                initial={false}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
              >
                <LandingHeroMockup />
              </motion.div>
            ) : (
              <div className="relative z-[1]">
                <LandingHeroMockup />
              </div>
            )}
          </LandingReveal>
        </div>
      </div>
      <LandingTrustStrip />
    </section>
  );
}
