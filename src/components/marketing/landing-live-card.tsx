"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useIsClient } from "@/hooks/use-is-client";
import { cn } from "@/lib/utils";

type LandingLiveCardProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  example: string;
  tag?: string;
  className?: string;
  delay?: number;
  featured?: boolean;
  children?: ReactNode;
};

export function LandingLiveCard({
  icon: Icon,
  title,
  description,
  example,
  tag,
  className,
  delay = 0,
  featured = false,
}: LandingLiveCardProps) {
  const reduce = useReducedMotion();
  const isClient = useIsClient();

  const body = (
    <article
      className={cn(
        "landing-live-card group relative flex h-full flex-col overflow-hidden rounded-3xl border p-6 md:p-7",
        featured
          ? "landing-live-card--featured border-[color:var(--brand-border)]"
          : "border-[color:var(--border-default)]",
        className,
      )}
    >
      {featured ? (
        <div className="landing-live-card__shine pointer-events-none absolute inset-x-0 top-0 h-px" aria-hidden />
      ) : null}
      <div
        className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: "var(--brand-subtle)" }}
        aria-hidden
      />
      <div className="relative flex items-start justify-between gap-2">
        <div
          className="flex size-14 items-center justify-center rounded-xl border border-[color:var(--brand-border)] shadow-sm transition-transform duration-300 group-hover:scale-105"
          style={{ background: "var(--brand-subtle)" }}
        >
          <Icon className="size-6 text-[color:var(--brand-text)]" aria-hidden />
        </div>
        {tag ? (
          <span
            className="shrink-0 rounded-full border border-[color:var(--brand-border)] px-3 py-1.5 text-caption font-semibold uppercase tracking-wide text-[color:var(--brand-text)]"
            style={{ background: "var(--brand-subtle)" }}
          >
            {tag}
          </span>
        ) : null}
      </div>
      <h3 className="lex-marketing-card-title relative mt-5 text-[color:var(--text-primary)]">
        {title}
      </h3>
      <p className="lex-marketing-card-body relative mt-2.5 flex-1 text-[color:var(--text-secondary)]">
        {description}
      </p>
      <p className="lex-marketing-example relative mt-5 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay)]/80 px-3.5 py-3 text-[color:var(--text-muted)] transition-colors duration-300 group-hover:border-[color:var(--brand-border)] group-hover:text-[color:var(--text-secondary)]">
        {example}
      </p>
    </article>
  );

  if (!isClient || reduce) return body;

  return (
    <motion.div
      className="h-full"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: featured ? -8 : -6 }}
    >
      {body}
    </motion.div>
  );
}
