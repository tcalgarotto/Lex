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
      <div className="relative flex items-start justify-between gap-3">
        <h3 className="lex-marketing-card-title relative flex flex-1 items-start gap-3 text-[color:var(--text-primary)]">
          <Icon className="mt-0.5 size-5 shrink-0 text-[color:var(--brand-text)]" aria-hidden />
          <span>{title}</span>
        </h3>
        {tag ? (
          <span className="shrink-0 rounded-md border border-[color:var(--border-subtle)] px-2.5 py-1 text-micro font-medium text-[color:var(--text-muted)]">
            {tag}
          </span>
        ) : null}
      </div>
      <p className="lex-marketing-card-body relative mt-3 flex-1 pl-8 text-[color:var(--text-secondary)]">
        {description}
      </p>
      <p className="lex-marketing-example relative mt-5 border-t border-[color:var(--border-subtle)] pt-4 pl-8 text-[color:var(--text-muted)]">
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
