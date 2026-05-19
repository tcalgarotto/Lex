import type { ReactNode } from "react";
import Link from "next/link";
import { LandingHeader } from "@/components/marketing/landing-header";
import { LandingFooter } from "@/components/marketing/landing-footer";
import { LANDING_CONTENT } from "@/lib/marketing/landing-copy";
import { cn } from "@/lib/utils";

export function LegalDocPage({
  title,
  updatedLabel,
  children,
}: {
  title: string;
  updatedLabel: string;
  children: ReactNode;
}) {
  return (
    <>
      <LandingHeader />
      <main className={cn(LANDING_CONTENT, "py-12 md:py-16")}>
        <article className="mx-auto max-w-3xl">
        <p className="text-[11px] font-medium uppercase tracking-widest text-[color:var(--text-muted)]">
          {updatedLabel}
        </p>
        <h1 className="mt-2 font-serif text-3xl font-normal tracking-tight text-[color:var(--text-primary)]">
          {title}
        </h1>
        <div className="prose-legal mt-8 space-y-6 text-[15px] leading-relaxed text-[color:var(--text-secondary)]">
          {children}
        </div>
        <p className="mt-10 text-sm">
          <Link href="/" className="text-[color:var(--brand-text)] hover:underline">
            ← Voltar ao início
          </Link>
        </p>
        </article>
      </main>
      <LandingFooter />
    </>
  );
}
