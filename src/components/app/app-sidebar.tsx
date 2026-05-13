"use client";

import { memo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Briefcase,
  ChevronDown,
  ChevronRight,
  FileText,
  Library,
  FolderKanban,
  Home,
  PanelLeft,
  PanelLeftClose,
  Search,
  ScrollText,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useUiStore } from "@/stores/ui-store";
import { useWorkspaceContext } from "@/components/app/workspace-context";
import { SidebarAccountFooter } from "@/components/app/sidebar-account-footer";
import { hasAtLeast } from "@/lib/auth/permissions";
import { prefetchOnce } from "@/lib/navigation/prefetch-routes";
import { MembershipRole } from "@prisma/client";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const CORE_NAV: NavItem[] = [
  { href: "/dashboard", label: "Início", icon: Home },
  { href: "/cases", label: "Casos", icon: Briefcase },
  { href: "/documentos", label: "Documentos", icon: FileText },
  { href: "/biblioteca", label: "Biblioteca", icon: Library },
  { href: "/pesquisa-juridica", label: "Pesquisa jurídica", icon: Search },
  { href: "/editor", label: "Peças", icon: ScrollText },
  { href: "/processos", label: "Processos judiciais", icon: FolderKanban },
];

const WORKSPACE_ADMIN_NAV: NavItem[] = [
  { href: "/settings/team", label: "Equipe", icon: Users },
];

function isAdmin(role: MembershipRole | undefined): boolean {
  if (!role) return false;
  return hasAtLeast(role, MembershipRole.ADMIN);
}

const NavLink = memo(function NavLink({
  item,
  pathname,
  collapsed,
  muted = false,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
  muted?: boolean;
}) {
  const router = useRouter();
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;
  const warm = () => prefetchOnce(router, item.href);
  return (
    <Link href={item.href} prefetch={false} onMouseEnter={warm} onFocus={warm}>
      <span
        className={cn(
          "relative flex min-h-[44px] items-center gap-3 rounded-md px-3 py-2.5 text-base font-semibold leading-snug transition-colors hover:bg-[var(--bg-hover)]",
          muted && !active && "text-[color:var(--text-muted)]",
          !muted && !active && "text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]",
          active &&
            "bg-[rgba(124,58,237,0.08)] text-[color:var(--violet-400)] before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:rounded-r-sm before:bg-[var(--violet-500)] before:content-['']",
          collapsed && "justify-center px-0",
        )}
      >
        <Icon className={cn("size-5 shrink-0", active ? "opacity-100" : "opacity-80")} />
        {!collapsed ? item.label : null}
      </span>
    </Link>
  );
});
NavLink.displayName = "NavLink";

/** Só esta árvore re-renderiza quando a rota muda (pathname). */
const SidebarMainNav = memo(function SidebarMainNav({
  collapsed,
}: {
  collapsed: boolean;
}) {
  const pathname = usePathname();
  const ws = useWorkspaceContext();
  const admin = isAdmin(ws?.current.role);

  const workspaceAdminActive = WORKSPACE_ADMIN_NAV.some(
    (n) => pathname === n.href || pathname.startsWith(`${n.href}/`),
  );
  const [workspaceOpen, setWorkspaceOpen] = useState(workspaceAdminActive);

  return (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
      {CORE_NAV.map((item) => (
        <NavLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
      ))}

      {admin ? (
        <>
          <button
            type="button"
            onClick={() => setWorkspaceOpen((v) => !v)}
            className={cn(
              "mt-3 flex min-h-[40px] items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold uppercase tracking-wide text-[color:var(--text-secondary)] hover:bg-[var(--bg-hover)]",
              collapsed && "justify-center px-0",
            )}
            aria-expanded={workspaceOpen}
          >
            {workspaceOpen ? (
              <ChevronDown className="size-4 shrink-0" />
            ) : (
              <ChevronRight className="size-4 shrink-0" />
            )}
            {!collapsed ? <span>Workspace</span> : null}
          </button>
          {workspaceOpen
            ? WORKSPACE_ADMIN_NAV.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  collapsed={collapsed}
                  muted
                />
              ))
            : null}
        </>
      ) : null}
    </nav>
  );
});
SidebarMainNav.displayName = "SidebarMainNav";

const SidebarFooter = memo(function SidebarFooter({ collapsed }: { collapsed: boolean }) {
  const ws = useWorkspaceContext();
  if (!ws?.viewer || !ws.current) return null;
  return (
    <div className="space-y-2 border-t border-[color:var(--border-subtle)] p-2 pt-3">
      <SidebarAccountFooter
        viewer={ws.viewer}
        role={ws.current.role}
        collapsed={collapsed}
        workspace={
          ws.workspaces?.length ? { current: ws.current, workspaces: ws.workspaces } : null
        }
      />
    </div>
  );
});
SidebarFooter.displayName = "SidebarFooter";

export const AppSidebar = memo(function AppSidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);

  return (
    <aside
      className={cn(
        "fixed left-0 z-40 flex flex-col border-r border-[color:var(--border-subtle)] bg-[color:var(--bg-sidebar)]",
        "top-[var(--app-header-h)] h-[calc(100svh-var(--app-header-h))]",
        "w-[268px] transition-[width] duration-200 ease-out motion-reduce:transition-none",
        collapsed && "w-20",
      )}
    >
      <div
        className={cn(
          "flex h-12 shrink-0 items-center border-b border-[color:var(--border-subtle)] px-2",
          collapsed ? "justify-center" : "justify-end",
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => toggle()}
          aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
        >
          {collapsed ? <PanelLeft className="size-5" /> : <PanelLeftClose className="size-5" />}
        </Button>
      </div>
      <Separator className="bg-[var(--border-subtle)]" />
      <SidebarMainNav collapsed={collapsed} />
      <SidebarFooter collapsed={collapsed} />
    </aside>
  );
});
AppSidebar.displayName = "AppSidebar";
