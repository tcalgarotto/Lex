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
}: {
  title: string;
  children: React.ReactNode;
}) {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const ws = useWorkspaceContext();
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <AppSidebar />
      <CommandMenu />
      <div
        className={cn(
          "flex min-h-screen flex-col transition-[margin] duration-200",
          collapsed ? "ml-[72px]" : "ml-[240px]",
        )}
      >
        <AppTopbar
          title={title}
          current={ws?.current}
          workspaces={ws?.workspaces}
        />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
