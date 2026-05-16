import type { ReactNode } from "react";
import { LANDING_CONTENT } from "@/lib/marketing/landing-copy";
import { cn } from "@/lib/utils";

type LandingSectionProps = {
  id?: string;
  className?: string;
  children: ReactNode;
  variant?: "default" | "muted" | "accent" | "cta";
};

/** Seção com fundo full width; conteúdo interno em ~80% da tela. */
export function LandingSection({ id, className, children, variant = "default" }: LandingSectionProps) {
  return (
    <section
      id={id}
      className={cn(
        "w-full scroll-mt-[4.75rem] sm:scroll-mt-[5.25rem]",
        variant === "muted" &&
          "border-y border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay)]/50",
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
          "py-14 sm:py-16 md:py-20 lg:py-24",
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
        "mb-8 md:mb-12",
        align === "center" && "mx-auto max-w-3xl text-center",
        align === "left" && "max-w-2xl",
      )}
    >
      {eyebrow ? (
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-text)]">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="font-serif text-[1.65rem] font-normal leading-[1.12] tracking-tight text-[color:var(--text-primary)] sm:text-[1.9rem] md:text-[2.15rem]">
        {title}
      </h2>
      {description ? (
        <p className="mt-3 text-[15px] leading-relaxed text-[color:var(--text-secondary)] md:text-base">
          {description}
        </p>
      ) : null}
    </header>
  );
}
