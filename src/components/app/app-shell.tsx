"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { memo, useMemo } from "react";
import { useUiStore } from "@/stores/ui-store";
import { useAppChromeTitleStore } from "@/stores/app-chrome-title-store";
import { matchPathTitle } from "@/lib/app-chrome-titles";
import { cn } from "@/lib/utils";
import { AppSidebar } from "@/components/app/app-sidebar";
import { AppTopbar } from "@/components/app/app-topbar";
import { CoreRoutePrefetcher } from "@/components/app/core-route-prefetcher";
import { useWorkspaceContext } from "@/components/app/workspace-context";

/** cmdk + dialog — carrega após o shell para não competir com o JS inicial da rota. */
const CommandMenuLazy = dynamic(
  () => import("@/components/app/command-menu").then((m) => m.CommandMenu),
  { ssr: false },
);

function useResolvedChromeTitle(): string {
  const pathname = usePathname() ?? "";
  const override = useAppChromeTitleStore((s) => s.titleOverride);
  return useMemo(
    () => override ?? matchPathTitle(pathname),
    [override, pathname],
  );
}

/** Topbar isolada: única zona que combina rota + override de título. */
const ChromeTop = memo(function ChromeTop() {
  const title = useResolvedChromeTitle();
  const ws = useWorkspaceContext();
  return <AppTopbar title={title} workspaceLabel={ws?.current?.name} />;
});
ChromeTop.displayName = "ChromeTop";

const MainColumn = memo(function MainColumn({
  children,
}: {
  children: React.ReactNode;
}) {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const pathname = usePathname() ?? "";
  const agendaBleed = pathname === "/agenda";
  return (
    <div
      className={cn(
        "flex min-h-[calc(100svh-var(--app-header-h))] flex-1 flex-col transition-[margin] duration-200",
        collapsed ? "ml-[80px]" : "ml-[268px]",
      )}
    >
      <main
        className={cn(
          "relative z-10 flex min-h-0 flex-1 min-w-0 flex-col",
          agendaBleed && "px-0 py-0",
          !agendaBleed && "px-4 py-6 md:px-6 md:py-8 lg:px-8",
        )}
      >
          <div
            className={cn(
              "lex-app-content-well min-w-0",
              agendaBleed && "max-w-none mx-0 flex w-full flex-1 min-h-0 flex-col self-stretch",
            )}
          >
          <div
            className={cn(
              "lex-page-shell",
              agendaBleed && "!pb-0 flex min-h-0 flex-1 flex-col",
            )}
          >
            <div className={cn("lex-page-inner", agendaBleed && "!space-y-0 flex min-h-0 flex-1 flex-col")}>
              {children}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
});
MainColumn.displayName = "MainColumn";

/** Sidebar + coluna principal — sem subscrição a pathname/título. */
const ChromeBody = memo(function ChromeBody({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative z-10 flex min-h-0 flex-1">
      <AppSidebar />
      <MainColumn>{children}</MainColumn>
    </div>
  );
});
ChromeBody.displayName = "ChromeBody";

function AppShellFrame({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const ws = useWorkspaceContext();
  return (
    <div
      className={cn(
        "flex min-h-screen flex-col text-foreground",
        "[--app-header-h:4.75rem] md:[--app-header-h:5.5rem]",
      )}
    >
      <div className="lex-glass-mesh" aria-hidden>
        <span className="lex-glass-mesh__blob lex-glass-mesh__blob--a" />
        <span className="lex-glass-mesh__blob lex-glass-mesh__blob--b" />
        <span className="lex-glass-mesh__blob lex-glass-mesh__blob--c" />
        <span className="lex-glass-mesh__blob lex-glass-mesh__blob--d" />
      </div>

      <AppTopbar title={title} workspaceLabel={ws?.current?.name} />
      <CommandMenuLazy />

      <div className="relative z-10 flex min-h-0 flex-1">
        <AppSidebar />
        <div
          className={cn(
            "flex min-h-[calc(100svh-var(--app-header-h))] flex-1 flex-col transition-[margin] duration-200",
            collapsed ? "ml-[80px]" : "ml-[268px]",
          )}
        >
          <main
            className={cn(
              "relative z-10 flex min-h-0 flex-1 min-w-0 flex-col",
              "px-4 py-6 md:px-6 md:py-8 lg:px-8",
            )}
          >
            <div className="lex-app-content-well min-w-0">
              <div className="lex-page-shell">
                <div className="lex-page-inner">{children}</div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

/**
 * Chrome persistente do grupo `(app)` — montado uma vez no layout.
 * Título/topbar atualizam isoladamente; sidebar só reage a pathname na zona de links.
 */
export function AppChrome({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex min-h-screen flex-col text-foreground",
        "[--app-header-h:4.75rem] md:[--app-header-h:5.5rem]",
      )}
    >
      <div className="lex-glass-mesh" aria-hidden>
        <span className="lex-glass-mesh__blob lex-glass-mesh__blob--a" />
        <span className="lex-glass-mesh__blob lex-glass-mesh__blob--b" />
        <span className="lex-glass-mesh__blob lex-glass-mesh__blob--c" />
        <span className="lex-glass-mesh__blob lex-glass-mesh__blob--d" />
      </div>

      <ChromeTop />
      <CoreRoutePrefetcher />
      <CommandMenuLazy />
      <ChromeBody>{children}</ChromeBody>
    </div>
  );
}

/**
 * Shell completo para rotas **fora** de `(app)` (ex.: onboarding), onde não há `AppChrome` no layout.
 */
export function AppShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return <AppShellFrame title={title}>{children}</AppShellFrame>;
}
