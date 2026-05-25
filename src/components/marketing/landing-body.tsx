"use client";

import { Shield } from "lucide-react";
import {
  LANDING_SECURITY,
  LANDING_SECURITY_BRIEF,
  LANDING_WORKFLOW_BRIEF,
} from "@/lib/marketing/landing-copy";
import { LandingIntent } from "@/components/marketing/landing-intent";
import { LandingRecursosTeaser } from "@/components/marketing/landing-recursos-teaser";
import { LandingReveal } from "@/components/marketing/landing-reveal";
import { LandingSection, LandingSectionHeader } from "@/components/marketing/landing-section";

export function LandingBody() {
  return (
    <>
      <LandingIntent />
      <LandingRecursosTeaser />

      <LandingSection id="como-funciona">
        <LandingReveal>
          <LandingSectionHeader
            eyebrow="Como funciona"
            title="Três passos do contato à peça revisada"
            description="Fluxo natural para quem já vive entre cliente, documento, pesquisa e protocolo."
          />
        </LandingReveal>
        <ol className="mt-8 grid gap-5 md:grid-cols-3">
          {LANDING_WORKFLOW_BRIEF.map((step, i) => (
            <LandingReveal key={step.step} delay={i * 0.06}>
              <li className="landing-premium-card landing-workflow-step flex h-full flex-col rounded-2xl border border-[color:var(--border-default)] bg-[color:var(--surface-card)] p-6">
                <h3 className="lex-marketing-card-title text-[color:var(--text-primary)]">
                  <span className="mr-2 font-semibold tabular-nums text-[color:var(--brand-text)]">
                    {step.step}.
                  </span>
                  {step.title}
                </h3>
                <p className="lex-marketing-body mt-2 text-[color:var(--text-secondary)]">
                  {step.description}
                </p>
              </li>
            </LandingReveal>
          ))}
        </ol>
      </LandingSection>

      <LandingSection id="seguranca" variant="muted">
        <LandingReveal>
          <LandingSectionHeader
            eyebrow="Segurança e responsabilidade"
            title={LANDING_SECURITY.title}
            description={LANDING_SECURITY.description}
          />
        </LandingReveal>
        <ul className="mt-8 grid gap-4 md:grid-cols-3">
          {LANDING_SECURITY_BRIEF.map((item, i) => (
            <LandingReveal key={item.title} delay={i * 0.06}>
              <li className="landing-premium-card rounded-2xl border border-[color:var(--border-default)] bg-[color:var(--surface-card)] p-5">
                <h3 className="lex-marketing-card-title flex items-start gap-2.5 text-[color:var(--text-primary)]">
                  <Shield className="mt-0.5 size-5 shrink-0 text-[color:var(--brand-text)]" aria-hidden />
                  <span>{item.title}</span>
                </h3>
                <p className="lex-marketing-body mt-2 text-[color:var(--text-secondary)]">{item.desc}</p>
              </li>
            </LandingReveal>
          ))}
        </ul>
      </LandingSection>
    </>
  );
}
