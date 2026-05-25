"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LANDING_CONTENT, LANDING_FEATURES, LANDING_SECTION_PAD } from "@/lib/marketing/landing-copy";
import { LandingReveal } from "@/components/marketing/landing-reveal";
import { LandingSectionHeader } from "@/components/marketing/landing-section";

const TEASER_IDS = ["casos", "pesquisa", "pecas"] as const;

export function LandingRecursosTeaser() {
  const items = LANDING_FEATURES.filter((f) =>
    (TEASER_IDS as readonly string[]).includes(f.id),
  );

  return (
    <section id="recursos" className={`${LANDING_CONTENT} ${LANDING_SECTION_PAD}`}>
      <LandingReveal>
        <LandingSectionHeader
          eyebrow="Recursos"
          title="Três capacidades no dia a dia do escritório"
          description="Casos, pesquisa e minutas no mesmo fluxo. A lista completa está na página de recursos."
        />
      </LandingReveal>
      <ul className="mt-8 grid gap-4 md:grid-cols-3">
        {items.map((feat, i) => (
          <LandingReveal key={feat.id} delay={i * 0.05}>
            <li className="landing-premium-card h-full rounded-2xl border border-[color:var(--border-default)] bg-[color:var(--surface-card)] p-5">
              <h3 className="lex-marketing-card-title text-[color:var(--text-primary)]">{feat.title}</h3>
              <p className="lex-marketing-body mt-2 text-[color:var(--text-secondary)]">{feat.description}</p>
            </li>
          </LandingReveal>
        ))}
      </ul>
      <div className="mt-8 flex justify-center">
        <Button variant="outline" size="lg" className="h-12 min-h-12 rounded-xl px-6 py-3" asChild>
          <Link href="/produto">
            Ver todos os recursos
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </Button>
      </div>
    </section>
  );
}
