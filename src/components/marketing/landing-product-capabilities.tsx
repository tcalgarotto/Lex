"use client";

import { LANDING_CONTENT, LANDING_FEATURES, LANDING_SECTION_PAD } from "@/lib/marketing/landing-copy";
import { LandingReveal } from "@/components/marketing/landing-reveal";
import { LandingSectionHeader } from "@/components/marketing/landing-section";

/** Índice compacto de todas as capacidades (substitui bento 11×). */
export function LandingProductCapabilities() {
  return (
    <section
      id="capacidades"
      className={`${LANDING_CONTENT} ${LANDING_SECTION_PAD} border-t border-[color:var(--border-subtle)]`}
    >
      <LandingReveal>
        <LandingSectionHeader
          eyebrow="Referência"
          title="Índice de capacidades"
          description="Lista completa de funções do JustOS para consulta rápida durante a demonstração."
        />
      </LandingReveal>
      <dl className="mt-8 divide-y divide-[color:var(--border-subtle)] rounded-2xl border border-[color:var(--border-default)] bg-[color:var(--surface-card)]">
        {LANDING_FEATURES.map((feat, i) => (
          <LandingReveal key={feat.id} delay={i * 0.02}>
            <div className="grid gap-1 px-4 py-4 sm:grid-cols-[minmax(0,14rem)_1fr] sm:gap-6 sm:px-6">
              <dt className="lex-marketing-card-title text-[color:var(--text-primary)]">
                {feat.title}
                {feat.tag ? (
                  <span className="ml-2 text-caption font-normal text-[color:var(--brand-text)]">
                    ({feat.tag})
                  </span>
                ) : null}
              </dt>
              <dd className="lex-marketing-body text-[color:var(--text-secondary)]">
                {feat.description}
                <span className="mt-1 block text-caption text-[color:var(--text-muted)]">{feat.example}</span>
              </dd>
            </div>
          </LandingReveal>
        ))}
      </dl>
    </section>
  );
}
