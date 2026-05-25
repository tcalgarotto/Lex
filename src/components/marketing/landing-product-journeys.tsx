"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  LANDING_CONTENT,
  LANDING_PRODUCT_JOURNEYS,
  LANDING_SECTION_PAD,
  landingFeaturesByIds,
} from "@/lib/marketing/landing-copy";
import { LandingJourneyPanel } from "@/components/marketing/landing-journey-panel";
import { LandingReveal } from "@/components/marketing/landing-reveal";
import { LandingSectionHeader } from "@/components/marketing/landing-section";
import { cn } from "@/lib/utils";

export function LandingProductJourneys() {
  return (
    <section id="jornadas" className={`${LANDING_CONTENT} ${LANDING_SECTION_PAD}`}>
      <LandingReveal>
        <LandingSectionHeader
          eyebrow="Como o escritório trabalha"
          title="Três jornadas, um único caso"
          description="Em vez de uma grade de cards iguais, o JustOS segue o fluxo real: captar, organizar e redigir com revisão profissional."
        />
      </LandingReveal>

      <ol className="mt-10 space-y-14 md:space-y-20">
        {LANDING_PRODUCT_JOURNEYS.map((journey, index) => {
          const features = landingFeaturesByIds(journey.featureIds);
          const reverse = index % 2 === 1;

          return (
            <LandingReveal key={journey.id} delay={index * 0.06}>
              <li className="landing-journey">
                <div
                  className={cn(
                    "grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-12",
                    reverse && "lg:[&>*:first-child]:order-2",
                  )}
                >
                  <div className="min-w-0 space-y-4">
                    <p className="lex-marketing-eyebrow text-[color:var(--brand-text)]">
                      Jornada {journey.step} · {journey.title}
                    </p>
                    <h2 className="lex-marketing-section-title text-[color:var(--text-primary)]">
                      {journey.subtitle}
                    </h2>
                    <p className="lex-marketing-body text-[color:var(--text-secondary)]">
                      {journey.narrative}
                    </p>
                    <ul className="space-y-3 border-t border-[color:var(--border-subtle)] pt-4">
                      {features.map((feat) => (
                        <li key={feat.id} className="min-w-0">
                          <p className="lex-marketing-card-title text-[color:var(--text-primary)]">
                            {feat.title}
                          </p>
                          <p className="lex-marketing-caption mt-1 text-[color:var(--text-muted)]">
                            {feat.description}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <LandingJourneyPanel snippet={journey.snippet} className="w-full lg:max-w-lg lg:justify-self-end" />
                </div>
              </li>
            </LandingReveal>
          );
        })}
      </ol>

      <LandingReveal delay={0.12}>
        <div className="mt-12 flex flex-col items-center gap-4 text-center md:mt-16">
          <p className="lex-marketing-body max-w-xl text-[color:var(--text-secondary)]">
            Quer ver o fluxo na prática? Solicite acesso e percorra um caso de ponta a ponta com a equipe.
          </p>
          <Button size="lg" className="rounded-xl" asChild>
            <Link href="/#beta">
              Solicitar acesso
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </LandingReveal>
    </section>
  );
}
