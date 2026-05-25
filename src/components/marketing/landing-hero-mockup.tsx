import { BookOpen, Cloud, FileText, Scale, Sparkles } from "lucide-react";

const STATUS = [
  { label: "Autos no caso", icon: Cloud },
  { label: "Fundamentos vinculados", icon: Scale },
  { label: "Minuta em revisão", icon: FileText },
] as const;

const PIPELINE = ["Cliente", "Documentos", "Fundamentos", "Minuta"] as const;

const TABS = ["Caso", "Documentos", "Pesquisa", "Agenda"] as const;

export function LandingHeroMockup() {
  return (
    <div className="landing-showcase relative mx-auto w-full max-w-[600px] overflow-visible pt-4" aria-hidden>
      <div className="landing-showcase__frame relative overflow-hidden rounded-3xl border border-[color:var(--border-default)] bg-[color:var(--surface-card)]">
        <div className="landing-showcase__chrome flex items-center gap-2 border-b border-[color:var(--border-subtle)] px-4 py-3">
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
          <span className="ml-2 truncate text-caption font-medium text-[color:var(--text-muted)]">
            JustOS · Revisão contratual
          </span>
        </div>
        <div className="relative p-4 md:p-5">
          <div className="mb-4 flex flex-wrap gap-1.5">
            {TABS.map((label, i) => (
              <span
                key={label}
                className={
                  i === 0
                    ? "border-b-2 border-[color:var(--brand-primary)] px-1 pb-1 text-micro font-semibold text-[color:var(--text-primary)]"
                    : "px-1 pb-1 text-micro font-medium text-[color:var(--text-muted)]"
                }
              >
                {label}
              </span>
            ))}
          </div>
          <div className="landing-showcase__assistant mb-4 flex items-start gap-2.5 py-1">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-[color:var(--brand-text)]" aria-hidden />
            <div>
              <p className="text-micro font-semibold tracking-wide text-[color:var(--brand-text)]">
                Assistente no caso
              </p>
              <p className="mt-0.5 text-caption leading-snug text-[color:var(--text-primary)]">
                “Valide as cláusulas sensíveis e revise a minuta da contestação.”
              </p>
            </div>
          </div>
          <ul className="landing-showcase__status mb-4 divide-y divide-[color:var(--border-subtle)] border-y border-[color:var(--border-subtle)]">
            {STATUS.map(({ label, icon: Icon }) => (
              <li
                key={label}
                className="flex items-center gap-2.5 py-2.5 text-caption text-[color:var(--text-secondary)]"
              >
                <Icon className="size-3.5 shrink-0 text-[color:var(--brand-text)]" aria-hidden />
                {label}
              </li>
            ))}
          </ul>
          <div className="landing-showcase__pipeline mb-3 flex flex-wrap items-center gap-1">
            {PIPELINE.map((step, i) => (
              <span key={step} className="flex items-center gap-1">
                <span
                  className={
                    i < 3
                      ? "text-micro font-semibold text-[color:var(--brand-text)]"
                      : "text-micro font-medium text-[color:var(--text-muted)]"
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
          <div className="flex items-center gap-2 border-t border-dashed border-[color:var(--border-subtle)] pt-3 text-caption text-[color:var(--text-secondary)]">
            <BookOpen className="size-3.5 shrink-0 text-[color:var(--brand-text)]" />
            Fundamentos com fonte · prontos para a peça
          </div>
        </div>
      </div>
    </div>
  );
}
