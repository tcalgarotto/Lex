"use client";

import { memo } from "react";
import Link from "next/link";
import { Bell, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LexLogoMark } from "@/components/brand/lex-logo-mark";
import { useUiStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";

export const AppTopbar = memo(function AppTopbar({
  title,
  workspaceLabel,
}: {
  title: string;
  /** Nome do workspace ativo (mostrador ao lado da marca). */
  workspaceLabel?: string | null;
}) {
  const setCmd = useUiStore((s) => s.setCommandOpen);
  const officeLine = workspaceLabel?.trim() || "Escritório";

  return (
    <header
      className={cn(
        "lex-glass sticky top-0 z-50 w-full border-b border-[color:var(--glass-border)] shadow-[0_1px_0_rgba(255,255,255,0.04)]",
        "backdrop-blur-xl supports-[backdrop-filter]:bg-[color:var(--surface-overlay)]/75",
      )}
    >
      <div className="mx-auto flex h-[var(--app-header-h)] w-full max-w-[100vw] items-center gap-3 px-4 md:gap-5 md:px-8 lg:px-10">
        <div className="flex min-w-0 flex-1 items-center gap-3 md:gap-4">
          <Link
            href="/dashboard"
            className="flex shrink-0 items-center rounded-lg p-1 text-[color:var(--text-primary)] transition-colors hover:bg-[color:var(--surface-overlay-strong)]"
            title="Lex — ir ao briefing"
            aria-label="Lex — ir ao briefing"
          >
            <LexLogoMark className="size-10 md:size-11" />
          </Link>

          <span
            className="hidden h-9 w-px shrink-0 bg-[color:var(--border-subtle)] sm:block"
            aria-hidden
          />
          <div className="min-w-0 flex-1 sm:max-w-[min(52vw,32rem)] lg:max-w-[min(40vw,28rem)]">
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--text-muted)] md:text-[11px]">
              {officeLine}
            </p>
            <h1 className="truncate text-base font-semibold leading-tight text-[color:var(--text-primary)] md:text-lg lg:text-xl">
              {title}
            </h1>
          </div>
        </div>

        <div className="hidden min-w-0 flex-[1.1] justify-center px-2 md:flex">
          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-11 w-full max-w-xl justify-start gap-3 rounded-xl border-[color:var(--border-default)]",
              "bg-[color:var(--surface-elevated)]/80 text-left text-sm text-[color:var(--text-secondary)] shadow-sm",
              "hover:bg-[color:var(--surface-overlay-strong)] hover:text-[color:var(--text-primary)]",
            )}
            onClick={() => setCmd(true)}
          >
            <Search className="size-4 shrink-0 opacity-80" aria-hidden />
            <span className="truncate font-normal">Busca global, atalhos e navegação…</span>
            <kbd className="lex-kbd ml-auto hidden shrink-0 text-[11px] lg:inline">⌘K</kbd>
          </Button>
        </div>

        <div className="flex shrink-0 items-center gap-1 md:gap-2">
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

          <Button
            variant="ghost"
            size="icon"
            className="hidden h-10 w-10 rounded-xl opacity-45 xl:flex"
            disabled
            title="Notificações em breve"
          >
            <Bell className="size-4" />
          </Button>
        </div>
      </div>
    </header>
  );
});
AppTopbar.displayName = "AppTopbar";
