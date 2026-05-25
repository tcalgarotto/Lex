"use client";

import { LANDING_CONTENT, LANDING_FINAL_CTA, LANDING_SECTION_PAD } from "@/lib/marketing/landing-copy";
import { LandingBetaCta } from "@/components/marketing/landing-beta-cta";
import { LandingReveal } from "@/components/marketing/landing-reveal";
import { LandingSectionHeader } from "@/components/marketing/landing-section";

/** Formulário de acesso — segunda dobra (Fase 2 distill). */
export function LandingBetaSection() {
  return (
    <section
      id="beta"
      className={`${LANDING_CONTENT} ${LANDING_SECTION_PAD}`}
    >
      <LandingReveal>
        <LandingSectionHeader
          title={LANDING_FINAL_CTA.title}
          description={LANDING_FINAL_CTA.description}
        />
      </LandingReveal>
      <LandingReveal delay={0.08}>
        <div className="mt-8">
          <LandingBetaCta />
        </div>
      </LandingReveal>
    </section>
  );
}
