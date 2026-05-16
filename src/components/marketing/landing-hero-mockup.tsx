import { BookOpen, FileSearch, Gavel, ScrollText, Sparkles } from "lucide-react";

const FLOATING_CARDS = [
  {
    icon: FileSearch,
    label: "Fatos extraídos",
    detail: "12 pontos · 3 cláusulas sensíveis",
    className: "left-0 top-0 md:-left-6",
    delay: "0s",
  },
  {
    icon: BookOpen,
    label: "Fundamentos sugeridos",
    detail: "CC art. 186 · Súmula 331 STJ",
    className: "right-0 top-6 md:-right-4",
    delay: "0.15s",
  },
  {
    icon: Gavel,
    label: "Estratégia em revisão",
    detail: "2 linhas de atuação",
    className: "left-2 bottom-20 md:left-0",
    delay: "0.3s",
  },
  {
    icon: ScrollText,
    label: "Minuta em revisão",
    detail: "Petição inicial · aguardando você",
    className: "right-2 bottom-10 md:right-0",
    delay: "0.45s",
  },
  {
    icon: Sparkles,
    label: "Assistente no caso",
    detail: "Resumo e próximos passos",
    className: "bottom-0 left-1/2 -translate-x-1/2",
    delay: "0.6s",
  },
] as const;

export function LandingHeroMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[520px]" aria-hidden>
      <div
        className="lex-glass relative overflow-hidden rounded-2xl border border-[color:var(--border-default)] p-5 shadow-[var(--shadow-lg),var(--glass-shadow)] md:p-6"
        style={{ minHeight: "min(340px, 78vw)" }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_0%,var(--brand-subtle),transparent_55%)]" />
        <div className="relative space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--text-muted)]">
              Caso: Revisão contratual
            </p>
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-medium text-[color:var(--brand-text)]"
              style={{ background: "var(--brand-subtle)" }}
            >
              Em andamento
            </span>
          </div>
          <div
            className="rounded-lg border border-[color:var(--border-default)] p-3"
            style={{ background: "var(--surface-elevated)" }}
          >
            <p className="text-[11px] font-medium text-[color:var(--text-muted)]">Resumo do caso</p>
            <p className="mt-1 text-[13px] leading-snug text-[color:var(--text-primary)]">
              Próximo passo: validar documentos e revisar minuta da contestação.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { k: "Documentos", v: "8" },
              { k: "Fatos", v: "14" },
              { k: "Fontes", v: "6" },
            ].map((m) => (
              <div
                key={m.k}
                className="rounded-md border border-[color:var(--border-subtle)] py-2"
                style={{ background: "var(--surface-card)" }}
              >
                <p className="text-[10px] text-[color:var(--text-muted)]">{m.k}</p>
                <p className="text-sm font-semibold text-[color:var(--text-primary)]">{m.v}</p>
              </div>
            ))}
          </div>
          <div
            className="rounded-lg border border-dashed border-[color:var(--border-default)] p-2.5 text-[12px] text-[color:var(--text-secondary)]"
            style={{ background: "var(--surface-overlay)" }}
          >
            Fundamentos encontrados · legislação e jurisprudência · fonte vinculada ao trecho
          </div>
        </div>
      </div>

      {FLOATING_CARDS.map(({ icon: Icon, label, detail, className, delay }) => (
        <div
          key={label}
          className={`landing-float-card absolute hidden w-[min(100%,210px)] rounded-xl border border-[color:var(--glass-border)] bg-[color:var(--glass-bg)]/95 p-2.5 shadow-lg backdrop-blur-md md:block ${className}`}
          style={{ animationDelay: delay }}
        >
          <div className="flex items-start gap-2">
            <div
              className="flex size-7 shrink-0 items-center justify-center rounded-md border border-[color:var(--brand-border)]"
              style={{ background: "var(--brand-subtle)" }}
            >
              <Icon className="size-3.5 text-[color:var(--brand-text)]" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-[color:var(--text-primary)]">{label}</p>
              <p className="truncate text-[10px] text-[color:var(--text-muted)]">{detail}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
