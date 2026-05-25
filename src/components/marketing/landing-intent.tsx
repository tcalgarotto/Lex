"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { LANDING_CONTENT, LANDING_INTENT, LANDING_SECTION_PAD } from "@/lib/marketing/landing-copy";
import { LandingReveal } from "@/components/marketing/landing-reveal";
import { LandingSectionHeader } from "@/components/marketing/landing-section";

/** Narrativa problema → resolução em uma dobra (substitui grid problema/solução repetitivo). */
export function LandingIntent() {
  return (
    <section id="intencao" className={`${LANDING_CONTENT} ${LANDING_SECTION_PAD}`}>
      <LandingReveal>
        <LandingSectionHeader
          eyebrow="Por que o JustOS"
          title={LANDING_INTENT.title}
          description={LANDING_INTENT.lead}
        />
      </LandingReveal>
      <ul className="mt-10 grid gap-5 md:grid-cols-3">
        {LANDING_INTENT.outcomes.map((item, i) => (
          <LandingReveal key={item.gain} delay={i * 0.07}>
            <li className="landing-premium-card group flex h-full flex-col rounded-2xl border border-[color:var(--border-default)] bg-[color:var(--surface-card)] p-6">
              <p className="text-caption font-medium uppercase tracking-wide text-[color:var(--warning-text)]">
                {item.pain}
              </p>
              <ArrowRight
                className="landing-subtle-icon my-4 size-4 text-[color:var(--brand-text)] opacity-60"
                aria-hidden
              />
              <p className="lex-marketing-card-title mt-auto text-[color:var(--text-primary)]">{item.gain}</p>
              <p className="lex-marketing-body mt-2 text-[color:var(--text-secondary)]">{item.detail}</p>
            </li>
          </LandingReveal>
        ))}
      </ul>
      <LandingReveal delay={0.15}>
        <p className="mt-8 text-center text-caption text-[color:var(--text-muted)]">
          Detalhe de cada capacidade em{" "}
          <Link href="/produto" className="font-medium text-[color:var(--brand-text)] hover:underline">
            Recursos
          </Link>
          .
        </p>
      </LandingReveal>
    </section>
  );
}
