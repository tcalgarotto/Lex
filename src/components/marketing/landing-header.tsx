"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LexThemeToggle } from "@/components/ui/theme-toggle";
import { LANDING_BAR_INNER, LANDING_NAV, LANDING_SHELL_FULL } from "@/lib/marketing/landing-copy";
import { cn } from "@/lib/utils";

export function LandingHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  return (
    <header
      className={cn(
        `${LANDING_SHELL_FULL} sticky top-0 z-50 border-b transition-[background-color,backdrop-filter,box-shadow] duration-300`,
        scrolled
          ? "border-[color:var(--glass-border)] bg-[color:var(--glass-bg)]/90 shadow-sm backdrop-blur-xl"
          : "border-transparent bg-[color:var(--surface-base)]/40 backdrop-blur-md",
      )}
    >
      <div className={cn(LANDING_BAR_INNER, "flex items-center justify-between gap-3 py-4 md:py-5")}>
        <Link
          href="/#inicio"
          className="flex items-center gap-2.5 font-semibold tracking-tight text-[color:var(--text-primary)] lex-transition hover:opacity-90"
          aria-label="Lex — início"
        >
          <span
            className="flex size-9 items-center justify-center rounded-lg text-sm font-semibold text-[color:var(--text-inverse)]"
            style={{
              background: "var(--brand-primary)",
              boxShadow: "var(--shadow-violet)",
            }}
          >
            L
          </span>
          <span className="text-readable md:text-lg">Lex</span>
        </Link>

        <nav className="hidden items-center gap-8 xl:flex" aria-label="Principal">
          {LANDING_NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-body font-medium text-[color:var(--text-secondary)] lex-transition hover:text-[color:var(--text-primary)]"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
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
          <Link href="#beta" className="hidden sm:block">
            <Button
              size="sm"
              className="h-11 rounded-xl text-control border border-[color:var(--brand-border)] px-5 text-[color:var(--text-inverse)] shadow-[var(--shadow-violet)]"
              style={{ background: "var(--brand-primary)" }}
            >
              Solicitar acesso
            </Button>
          </Link>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="xl:hidden"
            aria-expanded={mobileOpen}
            aria-controls="landing-mobile-nav"
            aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </Button>
        </div>
      </div>

      {mobileOpen ? (
        <div
          id="landing-mobile-nav"
          className="w-full border-t border-[color:var(--border-subtle)] bg-[color:var(--glass-bg)]/98 backdrop-blur-xl xl:hidden"
        >
          <nav className={cn(LANDING_BAR_INNER, "flex flex-col gap-1 py-4")} aria-label="Principal mobile">
            {LANDING_NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="rounded-lg px-3 py-3.5 text-[16px] font-medium text-[color:var(--text-primary)] hover:bg-[color:var(--surface-overlay)]"
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </a>
            ))}
            <div className="mt-4 flex flex-col gap-2 border-t border-[color:var(--border-subtle)] pt-4">
              <LexThemeToggle className="w-fit" />
              <Link href="/login" onClick={() => setMobileOpen(false)}>
                <Button variant="outline" className="h-11 w-full">
                  Entrar
                </Button>
              </Link>
              <Link href="#beta" onClick={() => setMobileOpen(false)}>
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
      ) : null}
    </header>
  );
}
