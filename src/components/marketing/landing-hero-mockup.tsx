import { BookOpen, Cloud, FileText, Scale, Sparkles } from "lucide-react";

const METRICS = [
  { k: "Documentos", v: "8", icon: Cloud },
  { k: "Fatos", v: "14", icon: FileText },
  { k: "Fontes", v: "6", icon: Scale },
] as const;

const PIPELINE = ["Cliente", "Documentos", "Fundamentos", "Minuta"] as const;

const TABS = ["Caso", "Documentos", "Pesquisa", "Agenda"] as const;

export function LandingHeroMockup() {
  return (
    <div className="landing-showcase relative mx-auto w-full max-w-[600px]" aria-hidden>
      <div className="landing-showcase__glow" aria-hidden />
      <div className="landing-showcase__frame lex-glass relative overflow-hidden rounded-3xl border border-[color:var(--border-default)] shadow-[var(--shadow-lg),0_0_80px_-24px_color-mix(in_srgb,var(--brand-primary)_40%,transparent)]">
        <div className="landing-showcase__chrome flex items-center gap-2 border-b border-[color:var(--border-subtle)] px-4 py-3">
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
          <span className="ml-2 truncate text-caption font-medium text-[color:var(--text-muted)]">
            Lex · Caso #2847 — Revisão contratual
          </span>
        </div>
        <div className="relative p-4 md:p-5">
          <div className="mb-4 flex flex-wrap gap-1.5">
            {TABS.map((label, i) => (
              <span
                key={label}
                className={
                  i === 0
                    ? "rounded-md border border-[color:var(--brand-border)] bg-[color:var(--brand-subtle)] px-2.5 py-1 text-micro font-semibold text-[color:var(--brand-text)]"
                    : "rounded-md px-2.5 py-1 text-micro font-medium text-[color:var(--text-muted)]"
                }
              >
                {label}
              </span>
            ))}
          </div>
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-[color:var(--brand-border)] p-3" style={{ background: "color-mix(in srgb, var(--brand-subtle) 55%, transparent)" }}>
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[color:var(--brand-border)]" style={{ background: "var(--brand-subtle)" }}>
              <Sparkles className="size-4 text-[color:var(--brand-text)]" />
            </div>
            <div>
              <p className="text-micro font-semibold uppercase tracking-wide text-[color:var(--brand-text)]">IA nativa no caso</p>
              <p className="mt-0.5 text-caption leading-snug text-[color:var(--text-primary)]">
                “Valide as 3 cláusulas sensíveis e revise a minuta da contestação.”
              </p>
            </div>
          </div>
          <div className="mb-4 grid grid-cols-3 gap-2">
            {METRICS.map(({ k, v, icon: Icon }) => (
              <div key={k} className="landing-showcase__metric rounded-lg border border-[color:var(--border-subtle)] p-2.5 text-center">
                <Icon className="mx-auto mb-1 size-4 text-[color:var(--brand-text)]" />
                <p className="text-[9px] font-medium uppercase tracking-wide text-[color:var(--text-muted)]">{k}</p>
                <p className="text-readable font-bold text-[color:var(--text-primary)]">{v}</p>
              </div>
            ))}
          </div>
          <div className="landing-showcase__pipeline mb-3 flex flex-wrap items-center gap-1">
            {PIPELINE.map((step, i) => (
              <span key={step} className="flex items-center gap-1">
                <span
                  className={
                    i < 3
                      ? "rounded-full border border-[color:var(--brand-border)] bg-[color:var(--brand-subtle)] px-2 py-0.5 text-micro font-semibold text-[color:var(--brand-text)]"
                      : "rounded-full border border-dashed border-[color:var(--brand-border)] px-2 py-0.5 text-micro font-medium text-[color:var(--text-muted)]"
                  }
                >
                  {step}
                </span>
                {i < PIPELINE.length - 1 ? (
                  <span className="text-micro text-[color:var(--text-muted)]" aria-hidden>
                    →
                  </span>
                ) : null}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-[color:var(--brand-border)]/50 bg-[color:var(--surface-overlay)] px-3 py-2.5 text-caption text-[color:var(--text-secondary)]">
            <BookOpen className="size-3.5 shrink-0 text-[color:var(--brand-text)]" />
            Fundamentos com fonte · prontos para a peça
          </div>

        </div>
      </div>
    </div>
  );
}
