"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Briefcase,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileText,
  FolderKanban,
  GitBranch,
  Home,
  PanelLeft,
  PanelLeftClose,
  Search,
  ScrollText,
  Server,
  Settings,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useUiStore } from "@/stores/ui-store";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const PRIMARY_NAV: NavItem[] = [
  { href: "/dashboard", label: "Início", icon: Home },
  { href: "/cases", label: "Casos", icon: Briefcase },
  { href: "/documentos", label: "Documentos", icon: FileText },
  { href: "/pesquisa-juridica", label: "Pesquisa jurídica", icon: Search },
  { href: "/editor", label: "Peças", icon: ScrollText },
  { href: "/processos", label: "Processos judiciais", icon: FolderKanban },
  { href: "/settings/team", label: "Equipe", icon: Users },
];

const ADVANCED_NAV: NavItem[] = [
  { href: "/cockpit", label: "Cockpit operacional", icon: Activity },
  { href: "/strategy", label: "Laboratório de estratégia", icon: GitBranch },
  { href: "/retrieval/explain", label: "Retrieval (debug)", icon: Sparkles },
  { href: "/settings/jobs", label: "Jobs IA", icon: Zap },
  { href: "/settings/roteiros", label: "Roteiros de entrevista", icon: ClipboardList },
  { href: "/settings/admin", label: "Administração", icon: Server },
  { href: "/test-guide", label: "Guia de teste", icon: ClipboardList },
];

export function AppSidebar() {
  const pathname = usePathname();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);
  const setCmd = useUiStore((s) => s.setCommandOpen);

  const advancedActive = ADVANCED_NAV.some(
    (n) => pathname === n.href || pathname.startsWith(`${n.href}/`),
  );
  const [advancedOpen, setAdvancedOpen] = useState<boolean>(advancedActive);

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 240 }}
      transition={{ type: "spring", stiffness: 280, damping: 30 }}
      className="fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-white/10 bg-zinc-950/90 backdrop-blur-xl"
    >
      <div className="flex h-14 items-center justify-between px-3">
        <Link
          href="/dashboard"
          className={cn(
            "flex items-center gap-2 font-semibold tracking-tight",
            collapsed && "justify-center",
          )}
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-violet-600/20 text-violet-300">
            L
          </span>
          {!collapsed ? <span>Lex</span> : null}
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={() => toggle()}
          aria-label="Alternar sidebar"
        >
          {collapsed ? <PanelLeft className="size-4" /> : <PanelLeftClose className="size-4" />}
        </Button>
      </div>
      <Separator className="bg-white/10" />
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
        <Button
          variant="outline"
          className={cn(
            "mb-2 justify-start border-white/10 bg-white/5 text-left",
            collapsed && "justify-center px-0",
          )}
          onClick={() => setCmd(true)}
        >
          <Search className="size-4 shrink-0" />
          {!collapsed ? <span className="ml-2">Busca rápida ⌘K</span> : null}
        </Button>

        {PRIMARY_NAV.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            pathname={pathname}
            collapsed={collapsed}
          />
        ))}

        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className={cn(
            "mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs uppercase tracking-wide text-muted-foreground hover:bg-white/5",
            collapsed && "justify-center px-0",
          )}
          aria-expanded={advancedOpen}
        >
          {advancedOpen ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronRight className="size-3.5" />
          )}
          {!collapsed ? <span>Avançado</span> : null}
        </button>
        {advancedOpen
          ? ADVANCED_NAV.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                pathname={pathname}
                collapsed={collapsed}
                muted
              />
            ))
          : null}
      </nav>

      <div className="p-2">
        <NavLink
          item={{ href: "/settings/perfil", label: "Configurações", icon: Settings }}
          pathname={pathname}
          collapsed={collapsed}
          muted
        />
      </div>
    </motion.aside>
  );
}

function NavLink({
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
  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;
  return (
    <Link href={item.href}>
      <span
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-white/5",
          muted && "text-muted-foreground",
          active && "bg-white/10 text-foreground",
          collapsed && "justify-center px-0",
        )}
      >
        <Icon className="size-4 shrink-0 opacity-80" />
        {!collapsed ? item.label : null}
      </span>
    </Link>
  );
}
