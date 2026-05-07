"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BookOpen, Briefcase, ClipboardList, FolderKanban, GitBranch, Home, PanelLeftClose, PanelLeft, Search, Settings, Sparkles, Users } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useUiStore } from "@/stores/ui-store";

const nav = [
  { href: "/dashboard", label: "Início", icon: Home },
  { href: "/cases", label: "Casos", icon: Briefcase },
  { href: "/cockpit", label: "Cockpit", icon: Activity },
  { href: "/strategy", label: "Estratégia", icon: GitBranch },
  { href: "/processos", label: "Processos", icon: FolderKanban },
  { href: "/biblioteca", label: "Biblioteca", icon: BookOpen },
  { href: "/busca", label: "Busca", icon: Search },
  { href: "/retrieval/explain", label: "Retrieval", icon: Sparkles },
  { href: "/settings/team", label: "Equipe", icon: Users },
  { href: "/settings/jobs", label: "Jobs IA", icon: Settings },
  { href: "/test-guide", label: "Guia de teste", icon: ClipboardList },
];

export function AppSidebar() {
  const pathname = usePathname();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);
  const setCmd = useUiStore((s) => s.setCommandOpen);

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
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => toggle()} aria-label="Alternar sidebar">
          {collapsed ? <PanelLeft className="size-4" /> : <PanelLeftClose className="size-4" />}
        </Button>
      </div>
      <Separator className="bg-white/10" />
      <nav className="flex flex-1 flex-col gap-1 p-2">
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
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link key={href} href={href}>
              <span
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-white/5",
                  active && "bg-white/10 text-foreground",
                  collapsed && "justify-center px-0",
                )}
              >
                <Icon className="size-4 shrink-0 opacity-80" />
                {!collapsed ? label : null}
              </span>
            </Link>
          );
        })}
      </nav>
      <div className="p-2">
        <Link href="/settings/perfil">
          <span
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-white/5",
              collapsed && "justify-center px-0",
            )}
          >
            <Settings className="size-4" />
            {!collapsed ? "Configurações" : null}
          </span>
        </Link>
      </div>
    </motion.aside>
  );
}
