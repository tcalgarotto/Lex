"use client";

import { useUiStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";
import { AppSidebar } from "@/components/app/app-sidebar";
import { AppTopbar } from "@/components/app/app-topbar";
import { CommandMenu } from "@/components/app/command-menu";
import { useWorkspaceContext } from "@/components/app/workspace-context";

export function AppShell({
 title,
 children,
 fullWidthContent = false,
}: {
 title: string;
 children: React.ReactNode;
 /** Sem `max-width` nem padding horizontal no `main` — a página define a largura (ex.: Biblioteca a usar toda a área útil). */
 fullWidthContent?: boolean;
}) {
 const collapsed = useUiStore((s) => s.sidebarCollapsed);
 const ws = useWorkspaceContext();
 return (
 <div className="min-h-screen text-foreground">
 {/* Orbes fixos no viewport (camada 0, sob sidebar/conteúdo) */}
 <div className="lex-glass-mesh" aria-hidden>
 <span className="lex-glass-mesh__blob lex-glass-mesh__blob--a" />
 <span className="lex-glass-mesh__blob lex-glass-mesh__blob--b" />
 <span className="lex-glass-mesh__blob lex-glass-mesh__blob--c" />
 <span className="lex-glass-mesh__blob lex-glass-mesh__blob--d" />
 </div>
 <AppSidebar />
 <CommandMenu />
 <div
 className={cn("flex min-h-screen flex-col transition-[margin] duration-200",
 collapsed ? "ml-[72px]" : "ml-[220px]",
 )}
 >
 <AppTopbar
 title={title}
 current={ws?.current}
 workspaces={ws?.workspaces}
 />
 <main
 className={cn(
 "flex-1 min-w-0",
 fullWidthContent ? "w-full px-0 py-0" : "px-4 py-6 md:px-6 md:py-8 lg:px-8",
 )}
 >
 {children}
 </main>
 </div>
 </div>
 );
}
