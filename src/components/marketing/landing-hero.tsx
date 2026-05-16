"use client";

import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  LANDING_CONTENT,
  LANDING_HERO,
  LANDING_HERO_STATS,
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
      <div className={`relative ${LANDING_CONTENT} pb-14 pt-10 sm:pb-20 sm:pt-12 md:pb-24 md:pt-16`}>
        <div className="grid gap-12 lg:items-center lg:gap-14 xl:grid-cols-[minmax(0,1fr)_minmax(0,min(100%,520px))] xl:gap-16">
          <LandingReveal className="space-y-5 sm:space-y-6">
            <p
              className="lex-marketing-eyebrow inline-flex w-fit items-center rounded-full border border-[color:var(--brand-border)] px-3.5 py-2 text-[color:var(--brand-text)]"
              style={{ background: "var(--brand-subtle)" }}
            >
              {LANDING_HERO.badge}
            </p>
            <h1 className="lex-marketing-display landing-hero-title text-[color:var(--text-primary)]">
              {LANDING_HERO.title}
            </h1>
            <p className="lex-marketing-lead text-[color:var(--text-secondary)]">
              {LANDING_HERO.subtitle}
            </p>
            <p className="lex-marketing-body text-[color:var(--text-muted)]">
              {LANDING_HERO.microcopy}
            </p>
            <div className="grid gap-3 pt-2 sm:grid-cols-3">
              {LANDING_HERO_STATS.map((stat) => (
                <div
                  key={stat.label}
                  className="landing-hero-stat rounded-2xl border border-[color:var(--border-subtle)] px-4 py-3.5"
                >
                  <p className="text-control font-bold text-[color:var(--brand-text)]">{stat.value}</p>
                  <p className="lex-marketing-caption mt-1 text-[color:var(--text-muted)]">{stat.label}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-3 pt-1 sm:flex-row">
              <Link href="#beta" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="h-13 min-h-[3.25rem] w-full gap-2 rounded-xl border border-[color:var(--brand-border)] px-8 text-control text-[color:var(--text-inverse)] shadow-[var(--shadow-violet)] lex-transition hover:opacity-95 sm:w-auto"
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
                  className="h-13 min-h-[3.25rem] w-full rounded-xl border border-[color:var(--border-default)] bg-[color:var(--glass-bg)]/80 px-8 text-control backdrop-blur-xl hover:bg-[color:var(--surface-overlay-strong)] sm:w-auto"
                >
                  {LANDING_HERO.ctaSecondary}
                </Button>
              </Link>
            </div>
            <ul className="grid gap-2 pt-3 sm:grid-cols-2">
              {LANDING_PROOF_POINTS.map((point) => (
                <li
                  key={point}
                  className="landing-hero-proof flex items-center gap-2.5 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]/60 px-3.5 py-2.5 text-caption font-medium text-[color:var(--text-secondary)]"
                >
                  <Check className="size-4 shrink-0 text-[color:var(--brand-text)]" aria-hidden />
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
