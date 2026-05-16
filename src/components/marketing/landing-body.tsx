"use client";

import {
  AlertTriangle,
  BookMarked,
  Briefcase,
  Calendar,
  Cloud,
  FileText,
  Globe,
  History,
  Mail,
  Scale,
  Shield,
  Sparkles,
  Link2,
} from "lucide-react";
import {
  LANDING_AUDIENCE,
  LANDING_FEATURES,
  LANDING_FINAL_CTA,
  LANDING_PROBLEM,
  LANDING_SECURITY,
  LANDING_SOLUTION,
  LANDING_WORKFLOW,
} from "@/lib/marketing/landing-copy";
import { LandingBetaCta } from "@/components/marketing/landing-beta-cta";
import { LandingLiveCard } from "@/components/marketing/landing-live-card";
import { LandingReveal } from "@/components/marketing/landing-reveal";
import { LandingSection, LandingSectionHeader } from "@/components/marketing/landing-section";

const FEATURE_ICONS = {
  "native-ai": Sparkles,
  casos: Briefcase,
  documentos: Cloud,
  pesquisa: Scale,
  acervo: BookMarked,
  livros: BookMarked,
  pecas: FileText,
  agenda: Calendar,
  email: Mail,
  integracoes: Link2,
  site: Globe,
  biblioteca: History,
} as const;

export function LandingBody() {
  return (
    <>
      <LandingSection id="problema">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-start lg:gap-14">
          <LandingReveal>
            <LandingSectionHeader align="left" eyebrow="O problema" title={LANDING_PROBLEM.title} />
            <ul className="space-y-3.5">
              {LANDING_PROBLEM.items.map((item) => (
                <li
                  key={item}
                  className="flex gap-3 text-[14px] leading-relaxed text-[color:var(--text-secondary)]"
                >
                  <AlertTriangle
                    className="mt-0.5 size-4 shrink-0 text-[color:var(--warning-text)]"
                    aria-hidden
                  />
                  {item}
                </li>
              ))}
            </ul>
          </LandingReveal>

          <LandingReveal delay={0.1}>
            <div
              id="solucao"
              className="lex-glass rounded-2xl border border-[color:var(--border-default)] p-6 shadow-[var(--shadow-lg),var(--glass-shadow)] md:p-8"
            >
              <LandingSectionHeader align="left" eyebrow="A solução" title={LANDING_SOLUTION.title} />
              <ul className="grid gap-3 sm:grid-cols-2">
                {LANDING_SOLUTION.cards.map((card, i) => (
                  <li
                    key={card.title}
                    className="landing-live-card rounded-xl border border-[color:var(--border-subtle)] p-4"
                    style={{
                      background: i % 2 === 0 ? "var(--surface-card)" : "var(--surface-overlay)",
                    }}
                  >
                    <p className="text-sm font-semibold text-[color:var(--text-primary)]">{card.title}</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-[color:var(--text-secondary)]">
                      {card.desc}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </LandingReveal>
        </div>
      </LandingSection>

      <LandingSection id="recursos" variant="muted">
        <LandingReveal>
          <LandingSectionHeader
            eyebrow="Recursos"
            title="Tudo o que a rotina jurídica pede — como você já imagina o escritório ideal."
            description="Exemplos reais de uso: do primeiro documento à minuta revisada, com o caso sempre no centro."
          />
        </LandingReveal>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LANDING_FEATURES.map((feat, i) => {
            const Icon = FEATURE_ICONS[feat.id as keyof typeof FEATURE_ICONS] ?? Briefcase;
            return (
              <LandingLiveCard
                key={feat.id}
                icon={Icon}
                title={feat.title}
                description={feat.description}
                example={feat.example}
                tag={feat.tag}
                delay={i * 0.04}
                className={feat.id === "native-ai" ? "sm:col-span-2" : undefined}
              />
            );
          })}
        </div>
      </LandingSection>

      <LandingSection id="como-funciona">
        <LandingReveal>
          <LandingSectionHeader
            eyebrow="Como funciona"
            title="Seis passos do primeiro contato à peça revisada."
            description="Um fluxo natural para quem já vive entre cliente, documento, pesquisa e protocolo."
          />
        </LandingReveal>
        <ol className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {LANDING_WORKFLOW.map((step, i) => (
            <LandingReveal key={step.step} delay={i * 0.06}>
              <li className="landing-live-card flex h-full gap-4 rounded-2xl p-5">
                <span
                  className="flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-[color:var(--brand-border)] text-sm font-bold text-[color:var(--brand-text)]"
                  style={{ background: "var(--brand-subtle)" }}
                >
                  {step.step}
                </span>
                <div>
                  <h3 className="text-[15px] font-semibold text-[color:var(--text-primary)]">{step.title}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-[color:var(--text-secondary)]">
                    {step.description}
                  </p>
                </div>
              </li>
            </LandingReveal>
          ))}
        </ol>
      </LandingSection>

      <LandingSection id="para-escritorios" variant="accent">
        <LandingReveal>
          <LandingSectionHeader eyebrow="Para quem é" title="Feito para quem vive a advocacia no dia a dia." />
        </LandingReveal>
        <div className="grid gap-4 sm:grid-cols-2">
          {LANDING_AUDIENCE.map((card, i) => (
            <LandingReveal key={card.title} delay={i * 0.08}>
              <article className="landing-live-card h-full rounded-2xl p-6">
                <h3 className="text-[16px] font-semibold text-[color:var(--text-primary)]">{card.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-[color:var(--text-secondary)]">
                  {card.description}
                </p>
              </article>
            </LandingReveal>
          ))}
        </div>
      </LandingSection>

      <LandingSection id="seguranca" variant="muted">
        <LandingReveal>
          <LandingSectionHeader
            eyebrow="Segurança e responsabilidade"
            title={LANDING_SECURITY.title}
            description={LANDING_SECURITY.description}
          />
        </LandingReveal>
        <div className="grid gap-4 sm:grid-cols-2">
          {LANDING_SECURITY.points.map((item, i) => (
            <LandingReveal key={item.title} delay={i * 0.06}>
              <article className="landing-live-card rounded-2xl p-5">
                <Shield className="mb-3 size-5 text-[color:var(--brand-text)]" aria-hidden />
                <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">{item.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-[color:var(--text-secondary)]">{item.desc}</p>
              </article>
            </LandingReveal>
          ))}
        </div>
      </LandingSection>

      <LandingSection id="beta" variant="cta">
        <LandingReveal>
          <LandingSectionHeader
            title={LANDING_FINAL_CTA.title}
            description={LANDING_FINAL_CTA.description}
          />
        </LandingReveal>
        <LandingReveal delay={0.1}>
          <LandingBetaCta />
        </LandingReveal>
      </LandingSection>
    </>
  );
}
