import type { ReactNode } from "react";
import { LANDING_CONTENT } from "@/lib/marketing/landing-copy";
import { cn } from "@/lib/utils";

type LandingSectionProps = {
  id?: string;
  className?: string;
  children: ReactNode;
  variant?: "default" | "muted" | "accent" | "cta";
};

/** Seção com fundo full width; conteúdo interno em ~70% da viewport. */
export function LandingSection({ id, className, children, variant = "default" }: LandingSectionProps) {
  return (
    <section
      id={id}
      className={cn(
        "w-full scroll-mt-[4.75rem] sm:scroll-mt-[5.25rem]",
        variant === "muted" &&
          "border-y border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay)]",
        variant === "accent" &&
          "border-y border-[color:var(--border-subtle)] bg-[radial-gradient(ellipse_90%_70%_at_50%_-30%,var(--brand-subtle),transparent)]",
        variant === "cta" &&
          "border-y border-[color:var(--brand-border)]/30 bg-[radial-gradient(ellipse_100%_80%_at_50%_100%,var(--brand-subtle),transparent_65%)]",
        className,
      )}
    >
      <div
        className={cn(
          LANDING_CONTENT,
          "py-16 sm:py-20 md:py-24 lg:py-28",
          variant === "cta" && "py-16 md:py-20",
        )}
      >
        {children}
      </div>
    </section>
  );
}

export function LandingSectionHeader({
  eyebrow,
  title,
  description,
  align = "center",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "center" | "left";
}) {
  return (
    <header
      className={cn(
        "mb-10 md:mb-14",
        align === "center" && "mx-auto max-w-2xl text-center",
        align === "left" && "max-w-2xl",
      )}
    >
      {eyebrow ? (
        <p className="landing-section-kicker mb-3">{eyebrow}</p>
      ) : null}
      <h2 className="lex-marketing-section-title text-[color:var(--text-primary)]">
        {title}
      </h2>
      {description ? (
        <p
          className={cn(
            "lex-marketing-lead mt-4 text-[color:var(--text-secondary)]",
            align === "center" && "mx-auto max-w-2xl",
          )}
        >
          {description}
        </p>
      ) : null}
    </header>
  );
}
