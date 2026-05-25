"use client";

import { LANDING_CONTENT, LANDING_FAQ, LANDING_SECTION_PAD } from "@/lib/marketing/landing-copy";
import { LandingReveal } from "@/components/marketing/landing-reveal";
import { LandingSectionHeader } from "@/components/marketing/landing-section";

/** FAQ — heurística #10; `<details>` nativo (sem checkbox readonly). */
export function LandingFaq() {
  return (
    <section id="faq" className={`${LANDING_CONTENT} ${LANDING_SECTION_PAD}`}>
      <LandingReveal>
        <LandingSectionHeader
          eyebrow="Dúvidas frequentes"
          title="Perguntas que sócios e coordenadores costumam fazer"
          description="Respostas diretas. Para detalhes legais, consulte Termos e Privacidade."
        />
      </LandingReveal>
      <div className="mt-8 space-y-2">
        {LANDING_FAQ.map((item, i) => (
          <LandingReveal key={item.id} delay={i * 0.04}>
            <details className="group rounded-2xl border border-[color:var(--border-default)] bg-[color:var(--surface-card)]">
              <summary className="cursor-pointer list-none px-5 py-4 text-[16px] font-semibold text-[color:var(--text-primary)] marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="flex items-center justify-between gap-3">
                  {item.question}
                  <span
                    className="landing-faq-icon text-[color:var(--text-muted)]"
                    aria-hidden
                  >
                    +
                  </span>
                </span>
              </summary>
              <div className="border-t border-[color:var(--border-subtle)] px-5 pb-4 pt-2">
                <p className="lex-marketing-body text-[color:var(--text-secondary)]">{item.answer}</p>
              </div>
            </details>
          </LandingReveal>
        ))}
      </div>
    </section>
  );
}
