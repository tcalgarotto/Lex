"use client";

import { memo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LexLogoMark } from "@/components/brand/lex-logo-mark";
import { LexWordmark } from "@/components/brand/lex-wordmark";
import { useUiStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";
import { prefetchOnce } from "@/lib/navigation/prefetch-routes";

export const AppTopbar = memo(function AppTopbar({
  title,
  workspaceLabel,
}: {
  title: string;
  /** Nome do workspace ativo (mostrador ao lado da marca). */
  workspaceLabel?: string | null;
}) {
  const setCmd = useUiStore((s) => s.setCommandOpen);
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const router = useRouter();
  const officeLine = workspaceLabel?.trim() || "Escritório";
  const warmDashboard = () => prefetchOnce(router, "/dashboard");

  return (
    <header
      className={cn(
        "lex-glass sticky top-0 z-50 w-full border-b border-[color:var(--glass-border)] shadow-[0_1px_0_rgba(255,255,255,0.04)]",
        "backdrop-blur-xl supports-[backdrop-filter]:bg-[color:var(--surface-overlay)]/75",
      )}
    >
      <div className="flex h-[var(--app-header-h)] w-full max-w-[100vw] min-w-0 items-stretch">
        <div
          className={cn(
            "flex shrink-0 items-center transition-[width,padding] duration-200",
            sidebarCollapsed ? "w-20 justify-center px-1" : "w-[268px] pl-4 md:pl-6 lg:pl-8 pr-2",
          )}
        >
          <Link
            href="/dashboard"
            prefetch={false}
            onMouseEnter={warmDashboard}
            onFocus={warmDashboard}
            className="flex min-w-0 shrink-0 items-center gap-2 rounded-lg p-1 text-[color:var(--text-primary)] transition-colors hover:bg-[color:var(--surface-overlay-strong)] md:gap-2.5"
            title="Lex — ir ao briefing"
            aria-label="Lex — ir ao briefing"
          >
            <LexLogoMark className="size-10 md:size-11" />
            {!sidebarCollapsed ? <LexWordmark /> : null}
          </Link>
        </div>

        <span
          className="hidden h-9 w-px shrink-0 self-center bg-[color:var(--border-subtle)] sm:block"
          aria-hidden
        />

        <div className="flex min-w-0 flex-1 items-center px-4 md:px-6 lg:px-8">
          <div className="lex-app-header-split w-full min-w-0">
            <div className="lex-app-header-split__title flex min-w-0 items-center gap-3 md:gap-4">
              <div className="min-w-0 max-w-full">
                <p
                  className="truncate text-micro font-semibold uppercase tracking-[0.14em] text-[color:var(--text-muted)] md:text-caption"
                  title={officeLine}
                >
                  {officeLine}
                </p>
                <h1
                  className="truncate text-base font-semibold leading-tight text-[color:var(--text-primary)] md:text-lg lg:text-xl"
                  title={title}
                >
                  {title}
                </h1>
              </div>
            </div>

            <div className="lex-app-header-split__actions flex min-w-0 w-full items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="hidden h-11 w-11 shrink-0 rounded-xl text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-overlay-strong)] hover:text-[color:var(--text-primary)] md:flex"
                disabled
                title="Notificações em breve"
              >
                <Bell className="size-[22px] shrink-0" strokeWidth={1.75} aria-hidden />
              </Button>

              <Button
                type="button"
                variant="outline"
                className={cn(
                  "hidden h-11 min-w-0 shrink-0 justify-start gap-3 rounded-xl border-[color:var(--border-default)] md:inline-flex",
                  "w-[320px] max-w-full bg-[color:var(--surface-elevated)]/80 text-left text-sm text-[color:var(--text-secondary)] shadow-sm",
                  "hover:bg-[color:var(--surface-overlay-strong)] hover:text-[color:var(--text-primary)]",
                )}
                onClick={() => setCmd(true)}
              >
                <Search className="size-4 shrink-0 opacity-80" aria-hidden />
                <span className="truncate font-normal">Busca global, atalhos e navegação…</span>
                <kbd className="lex-kbd ml-auto hidden shrink-0 text-caption lg:inline">⌘K</kbd>
              </Button>

              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0 rounded-xl md:hidden"
                aria-label="Abrir busca global"
                onClick={() => setCmd(true)}
              >
                <Search className="size-4" />
              </Button>
            </div>

            <div className="lex-app-header-split__tail hidden min-h-0 md:block" aria-hidden />
          </div>
        </div>
      </div>
    </header>
  );
});
AppTopbar.displayName = "AppTopbar";
