import {
  AlertTriangle,
  BookMarked,
  Briefcase,
  FileText,
  History,
  Scale,
  Shield,
  Sparkles,
  Users,
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
import { LandingSection, LandingSectionHeader } from "@/components/marketing/landing-section";

const FEATURE_ICONS: Record<string, typeof Briefcase> = {
  casos: Briefcase,
  documentos: FileText,
  pesquisa: Sparkles,
  estrategia: Scale,
  pecas: FileText,
  biblioteca: BookMarked,
  equipe: Users,
  historico: History,
};

export function LandingBody() {
  return (
    <>
      <LandingSection id="problema">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-start lg:gap-16">
          <div>
            <LandingSectionHeader
              align="left"
              eyebrow="O problema"
              title={LANDING_PROBLEM.title}
            />
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
          </div>
          <div
            id="solucao"
            className="lex-glass rounded-2xl border border-[color:var(--border-default)] p-6 shadow-[var(--shadow-lg),var(--glass-shadow)] md:p-8"
          >
            <LandingSectionHeader
              align="left"
              eyebrow="A solução"
              title={LANDING_SOLUTION.title}
            />
            <ul className="grid gap-3 sm:grid-cols-2">
              {LANDING_SOLUTION.cards.map((card, i) => (
                <li
                  key={card.title}
                  className="rounded-xl border border-[color:var(--border-subtle)] p-4 lex-transition hover:border-[color:var(--border-strong)] hover:shadow-md"
                  style={{ background: i % 2 === 0 ? "var(--surface-card)" : "var(--surface-overlay)" }}
                >
                  <p className="text-sm font-semibold text-[color:var(--text-primary)]">{card.title}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-[color:var(--text-secondary)]">
                    {card.desc}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </LandingSection>

      <LandingSection id="recursos" variant="muted">
        <LandingSectionHeader
          eyebrow="Recursos"
          title="Tudo o que a rotina jurídica pede — sem trocar de ferramenta a cada etapa."
          description="Cada recurso foi pensado para conectar documentos, fundamentos e peças ao caso que você está conduzindo."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {LANDING_FEATURES.map((feat) => {
            const Icon = FEATURE_ICONS[feat.id] ?? Briefcase;
            return (
              <article
                key={feat.id}
                className="group lex-glass flex flex-col rounded-xl p-5 shadow-sm lex-transition hover:-translate-y-0.5 hover:border-[color:var(--border-strong)] hover:shadow-lg"
              >
                <div
                  className="mb-4 flex size-11 items-center justify-center rounded-xl border border-[color:var(--brand-border)]"
                  style={{ background: "var(--brand-subtle)" }}
                >
                  <Icon className="size-5 text-[color:var(--brand-text)]" aria-hidden />
                </div>
                <h3 className="text-[15px] font-semibold text-[color:var(--text-primary)]">{feat.title}</h3>
                <p className="mt-2 flex-1 text-[13px] leading-relaxed text-[color:var(--text-secondary)]">
                  {feat.description}
                </p>
              </article>
            );
          })}
        </div>
      </LandingSection>

      <LandingSection id="como-funciona">
        <LandingSectionHeader
          eyebrow="Como funciona"
          title="Seis passos do primeiro contato à peça revisada."
          description="Um fluxo natural para quem já vive entre cliente, documento, pesquisa e protocolo."
        />
        <ol className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {LANDING_WORKFLOW.map((step) => (
            <li
              key={step.step}
              className="flex gap-4 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]/30 p-5 lex-transition hover:border-[color:var(--border-default)] hover:shadow-md"
            >
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
          ))}
        </ol>
      </LandingSection>

      <LandingSection id="para-escritorios" variant="accent">
        <LandingSectionHeader
          eyebrow="Para quem é"
          title="Feito para quem vive a advocacia no dia a dia."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {LANDING_AUDIENCE.map((card) => (
            <article
              key={card.title}
              className="lex-glass rounded-xl p-5 lex-transition hover:shadow-lg"
            >
              <h3 className="text-[15px] font-semibold text-[color:var(--text-primary)]">{card.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-[color:var(--text-secondary)]">
                {card.description}
              </p>
            </article>
          ))}
        </div>
      </LandingSection>

      <LandingSection id="seguranca" variant="muted">
        <LandingSectionHeader
          eyebrow="Segurança e responsabilidade"
          title={LANDING_SECURITY.title}
          description={LANDING_SECURITY.description}
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LANDING_SECURITY.points.map((item) => (
            <article
              key={item.title}
              className="rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]/40 p-5"
            >
              <Shield className="mb-3 size-5 text-[color:var(--brand-text)]" aria-hidden />
              <h3 className="text-sm font-semibold text-[color:var(--text-primary)]">{item.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-[color:var(--text-secondary)]">{item.desc}</p>
            </article>
          ))}
        </div>
      </LandingSection>

      <LandingSection id="beta" variant="cta" fullBleed>
        <LandingSectionHeader
          title={LANDING_FINAL_CTA.title}
          description={LANDING_FINAL_CTA.description}
        />
        <LandingBetaCta />
      </LandingSection>
    </>
  );
}
