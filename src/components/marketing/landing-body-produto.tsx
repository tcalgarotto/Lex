"use client";

import { LandingProductCapabilities } from "@/components/marketing/landing-product-capabilities";
import { LandingProductJourneys } from "@/components/marketing/landing-product-journeys";
import {
  LANDING_AUDIENCE,
  LANDING_CONTENT,
  LANDING_SECTION_PAD,
  LANDING_WORKFLOW,
} from "@/lib/marketing/landing-copy";
import { LandingReveal } from "@/components/marketing/landing-reveal";
import { LandingSectionHeader } from "@/components/marketing/landing-section";

export function LandingBodyProduto() {
  return (
    <div className="space-y-0">
      <LandingProductJourneys />
      <LandingProductCapabilities />

      <section id="fluxo-completo" className={`w-full border-t border-[color:var(--border-subtle)] ${LANDING_SECTION_PAD}`}>
        <div className={LANDING_CONTENT}>
          <LandingReveal>
            <LandingSectionHeader
              eyebrow="Fluxo completo"
              title="Seis passos do primeiro contato à peça revisada"
              description="Detalhe operacional do que cada jornada cobre no dia a dia."
            />
          </LandingReveal>
          <ol className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {LANDING_WORKFLOW.map((step, i) => (
              <LandingReveal key={step.step} delay={i * 0.05}>
                <li className="landing-premium-card landing-workflow-step flex h-full flex-col rounded-2xl border border-[color:var(--border-default)] bg-[color:var(--surface-card)] p-6">
                  <span
                    className="mb-4 flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-[color:var(--brand-border)] text-sm font-bold text-[color:var(--brand-text)]"
                    style={{ background: "var(--brand-subtle)" }}
                  >
                    {step.step}
                  </span>
                  <h3 className="lex-marketing-card-title text-[color:var(--text-primary)]">{step.title}</h3>
                  <p className="lex-marketing-body mt-2 text-[color:var(--text-secondary)]">
                    {step.description}
                  </p>
                </li>
              </LandingReveal>
            ))}
          </ol>
        </div>
      </section>

      <section id="para-escritorios" className={`w-full border-t border-[color:var(--border-subtle)] ${LANDING_SECTION_PAD}`}>
        <div className={LANDING_CONTENT}>
          <LandingReveal>
            <LandingSectionHeader
              eyebrow="Para quem é"
              title="Feito para quem vive a advocacia no dia a dia."
            />
          </LandingReveal>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {LANDING_AUDIENCE.map((card, i) => (
              <LandingReveal key={card.title} delay={i * 0.06}>
                <article className="landing-premium-card h-full rounded-2xl border border-[color:var(--border-default)] bg-[color:var(--surface-card)] p-6">
                  <h3 className="lex-marketing-card-title text-[color:var(--text-primary)]">{card.title}</h3>
                  <p className="mt-2 lex-marketing-body text-[color:var(--text-secondary)]">
                    {card.description}
                  </p>
                </article>
              </LandingReveal>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
