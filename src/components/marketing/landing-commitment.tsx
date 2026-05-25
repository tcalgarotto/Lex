"use client";

import { Scale, ShieldCheck, Sparkles } from "lucide-react";
import {
  LANDING_COMMITMENTS,
  LANDING_CONTENT,
  LANDING_SECTION_PAD,
} from "@/lib/marketing/landing-copy";
import { LandingReveal } from "@/components/marketing/landing-reveal";
import { LandingSectionHeader } from "@/components/marketing/landing-section";

const ICONS = [Scale, Sparkles, ShieldCheck] as const;

/** Compromissos verificáveis — sem depoimentos ou logos inventados (PRODUCT.md). */
export function LandingCommitment() {
  return (
    <section id="compromissos" className={`${LANDING_CONTENT} ${LANDING_SECTION_PAD}`}>
      <LandingReveal>
        <LandingSectionHeader
          eyebrow="Compromissos"
          title="O que prometemos ao escritório"
          description="Princípios que guiam o produto hoje — transparência até termos de parceiros e casos reais para compartilhar."
        />
      </LandingReveal>
      <ul className="mt-8 grid gap-5 md:grid-cols-3">
        {LANDING_COMMITMENTS.map((item, i) => {
          const Icon = ICONS[i] ?? Scale;
          return (
            <LandingReveal key={item.title} delay={i * 0.06}>
              <li className="landing-premium-card h-full rounded-2xl border border-[color:var(--border-default)] bg-[color:var(--surface-card)] p-6">
                <h3 className="lex-marketing-card-title flex items-start gap-3 text-[color:var(--text-primary)]">
                  <Icon className="mt-0.5 size-5 shrink-0 text-[color:var(--brand-text)]" aria-hidden />
                  <span>{item.title}</span>
                </h3>
                <p className="lex-marketing-body mt-2 text-[color:var(--text-secondary)]">{item.description}</p>
              </li>
            </LandingReveal>
          );
        })}
      </ul>
    </section>
  );
}
