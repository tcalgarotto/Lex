"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JustOSLogo } from "@/components/brand/justos-logo";
import { LexThemeToggle } from "@/components/ui/theme-toggle";
import { LANDING_BAR_INNER, LANDING_NAV, LANDING_SHELL_FULL } from "@/lib/marketing/landing-copy";
import { cn } from "@/lib/utils";

const navLinkClass =
  "text-[15px] font-medium text-[color:var(--text-secondary)] lex-transition hover:text-[color:var(--text-primary)]";

export function LandingHeader() {
  return (
    <header
      className={cn(`${LANDING_SHELL_FULL} landing-header-shell sticky top-0 isolate z-[100]`)}
    >
      <div className={cn(LANDING_BAR_INNER, "flex items-center justify-between gap-4 py-3.5 md:py-4")}>
        <JustOSLogo href="/#inicio" markTone="neutral" />

        <nav
          className="hidden min-w-0 flex-1 items-center justify-center gap-5 lg:flex lg:gap-8 xl:gap-10"
          aria-label="Principal"
        >
          {LANDING_NAV.map((item) => (
            <Link key={item.href} href={item.href} className={cn(navLinkClass, "shrink-0 whitespace-nowrap")}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <LexThemeToggle className="hidden shrink-0 md:inline-flex" />
          <Link href="/login" className="hidden md:block">
            <Button
              variant="ghost"
              size="sm"
              className="text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-overlay)]"
            >
              Entrar
            </Button>
          </Link>
          <Link href="/#beta" className="hidden sm:block">
            <Button
              size="sm"
              className="h-10 rounded-xl text-control border border-[color:var(--brand-border)] px-4 text-[color:var(--text-inverse)] shadow-[var(--shadow-sm)]"
              style={{ background: "var(--brand-primary)" }}
            >
              Solicitar acesso
            </Button>
          </Link>

          <details id="landing-mobile-menu" className="group relative lg:hidden">
            <summary
              className="flex size-10 cursor-pointer list-none items-center justify-center rounded-md hover:bg-[color:var(--surface-overlay)] [&::-webkit-details-marker]:hidden"
              aria-label="Abrir menu"
            >
              <Menu className="size-5 group-open:hidden" aria-hidden />
              <X className="hidden size-5 group-open:block" aria-hidden />
            </summary>
            <div
              id="landing-mobile-nav"
              className="absolute right-0 top-[calc(100%+0.25rem)] z-[110] w-[min(100vw,24rem)] border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] shadow-lg"
            >
              <nav className="flex flex-col gap-1 p-3" aria-label="Principal mobile">
                {LANDING_NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-lg px-3 py-3.5 text-[16px] font-medium text-[color:var(--text-primary)] hover:bg-[color:var(--surface-overlay)]"
                  >
                    {item.label}
                  </Link>
                ))}
                <div className="mt-2 flex flex-col gap-2 border-t border-[color:var(--border-subtle)] pt-3">
                  <LexThemeToggle className="w-fit" />
                  <Link href="/login">
                    <Button variant="outline" className="h-11 w-full">
                      Entrar
                    </Button>
                  </Link>
                  <Link href="/#beta">
                    <Button
                      className="h-11 w-full rounded-lg border border-[color:var(--brand-border)] text-[color:var(--text-inverse)]"
                      style={{ background: "var(--brand-primary)" }}
                    >
                      Solicitar acesso
                    </Button>
                  </Link>
                </div>
              </nav>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
