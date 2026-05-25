"use client";

import { Briefcase, FileText, Scale } from "lucide-react";
import { LANDING_CONTENT, LANDING_PILLARS, LANDING_SECTION_PAD } from "@/lib/marketing/landing-copy";
import { LandingReveal } from "@/components/marketing/landing-reveal";
import { LandingSectionHeader } from "@/components/marketing/landing-section";

const ICONS = [Briefcase, Scale, FileText] as const;

export function LandingPillars() {
  return (
    <section id="pilares" className={`${LANDING_CONTENT} ${LANDING_SECTION_PAD}`}>
      <LandingReveal>
        <LandingSectionHeader
          eyebrow="O essencial"
          title="Três pilares para o escritório no dia a dia"
          description="Tudo gira em torno do caso: organizar, fundamentar e redigir com revisão profissional antes de protocolar."
        />
      </LandingReveal>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {LANDING_PILLARS.map((pillar, i) => {
          const Icon = ICONS[i] ?? Briefcase;
          return (
            <LandingReveal key={pillar.title} delay={i * 0.06}>
              <article className="landing-premium-card h-full rounded-2xl border border-[color:var(--border-default)] bg-[color:var(--surface-card)] p-6">
                <h3 className="lex-marketing-card-title flex items-start gap-3 text-[color:var(--text-primary)]">
                  <Icon className="mt-0.5 size-5 shrink-0 text-[color:var(--brand-text)]" aria-hidden />
                  <span>{pillar.title}</span>
                </h3>
                <p className="lex-marketing-body mt-2 text-[color:var(--text-secondary)]">{pillar.description}</p>
              </article>
            </LandingReveal>
          );
        })}
      </div>
    </section>
  );
}
