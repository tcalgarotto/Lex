"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LANDING_HERO } from "@/lib/marketing/landing-copy";

/** CTA fixo no rodapé da viewport — thumb zone em mobile */
export function LandingMobileCta() {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--border-default)] bg-[color:var(--surface-card)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-md)] md:hidden"
      aria-hidden={false}
    >
      <Link href="#beta" className="pointer-events-auto block">
        <Button
          size="lg"
          className="h-12 w-full gap-2 rounded-xl border border-[color:var(--brand-border)] text-[color:var(--text-inverse)]"
          style={{ background: "var(--brand-primary)" }}
        >
          {LANDING_HERO.ctaPrimary}
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </Link>
    </div>
  );
}
