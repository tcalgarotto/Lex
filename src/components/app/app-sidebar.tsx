"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
 Activity,
 BookOpen,
 Briefcase,
 ChevronDown,
 ChevronRight,
 ClipboardList,
 FileText,
 Library,
 FolderKanban,
 GitBranch,
 Home,
 PanelLeft,
 PanelLeftClose,
 Search,
 ScrollText,
 Server,
 Settings,
 Users,
 Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useUiStore } from "@/stores/ui-store";
import { useWorkspaceContext } from "@/components/app/workspace-context";
import { LexSidebarThemeToggle } from "@/components/ui/theme-toggle";
import { hasAtLeast } from "@/lib/auth/permissions";
import { MembershipRole } from "@prisma/client";

interface NavItem {
 href: string;
 label: string;
 icon: LucideIcon;
}

/**
 * Núcleo do produto — o que o advogado usa no dia a dia:
 * documentos, casos, pesquisa, peças, biblioteca e processos CNJ.
 */
const CORE_NAV: NavItem[] = [
 { href: "/dashboard", label: "Início", icon: Home },
 { href: "/cases", label: "Casos", icon: Briefcase },
 { href: "/documentos", label: "Documentos", icon: FileText },
 { href: "/biblioteca", label: "Biblioteca", icon: Library },
 { href: "/pesquisa-juridica", label: "Pesquisa jurídica", icon: Search },
 { href: "/editor", label: "Peças", icon: ScrollText },
 { href: "/processos", label: "Processos judiciais", icon: FolderKanban },
];

/** Gestão do workspace — administradores. */
const WORKSPACE_ADMIN_NAV: NavItem[] = [
 { href: "/settings/team", label: "Equipe", icon: Users },
 { href: "/settings/roteiros", label: "Roteiros de entrevista", icon: ClipboardList },
];

/** Ferramentas internas / engenharia — não fazem parte da jornada típica do cliente. */
const DEV_ADMIN_NAV: NavItem[] = [
 { href: "/cockpit", label: "Cockpit operacional", icon: Activity },
 { href: "/strategy", label: "Laboratório de estratégia", icon: GitBranch },
 { href: "/settings/jobs", label: "Jobs IA", icon: Zap },
 { href: "/settings/admin", label: "Administração", icon: Server },
 { href: "/test-guide", label: "Guia de teste", icon: BookOpen },
];

function isAdmin(role: MembershipRole | undefined): boolean {
 if (!role) return false;
 return hasAtLeast(role, MembershipRole.ADMIN);
}

export function AppSidebar() {
 const pathname = usePathname();
 const collapsed = useUiStore((s) => s.sidebarCollapsed);
 const toggle = useUiStore((s) => s.toggleSidebar);
 const setCmd = useUiStore((s) => s.setCommandOpen);
 const ws = useWorkspaceContext();
 const admin = isAdmin(ws?.current.role);

 const workspaceAdminActive = WORKSPACE_ADMIN_NAV.some(
 (n) => pathname === n.href || pathname.startsWith(`${n.href}/`),
 );
 const [workspaceOpen, setWorkspaceOpen] = useState(workspaceAdminActive);

 const devNavActive = DEV_ADMIN_NAV.some(
 (n) => pathname === n.href || pathname.startsWith(`${n.href}/`),
 );
 /** Abre automaticamente quando já está numa rota técnica. */
 const [devNavOpen, setDevNavOpen] = useState(devNavActive);

 return (
 <motion.aside
 initial={false}
 animate={{ width: collapsed ? 72 : 220 }}
 transition={{ type: "spring", stiffness: 280, damping: 30 }}
 className="fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-[color:var(--border-subtle)] bg-[color:var(--bg-sidebar)]"
 >
 <div className="flex h-14 items-center justify-between px-3">
 <Link
 href="/dashboard"
 className={cn("flex items-center gap-2 font-semibold tracking-tight",
 collapsed && "justify-center",
 )}
 >
 <span className="flex size-7 items-center justify-center rounded-md bg-[var(--violet-500)] text-sm font-semibold text-white">
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
 <Separator className="bg-[var(--border-subtle)]" />
 <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
 <Button
 variant="outline"
 className={cn("mb-2 flex w-full items-center justify-start gap-2 border-[0.5px] border-[color:var(--border-default)] bg-[color:var(--surface-elevated)] py-2.5 text-left text-[13px] text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-overlay-strong)] hover:text-[color:var(--text-primary)]",
 collapsed && "justify-center px-0",
 )}
 onClick={() => setCmd(true)}
 >
 <Search className="size-4 shrink-0 opacity-90" />
 {!collapsed ? <span className="ml-1 font-medium">Busca rápida</span> : null}
 {!collapsed ? (
 <kbd className="lex-kbd ml-auto hidden text-[10px] sm:inline">⌘K</kbd>
 ) : null}
 </Button>

 {CORE_NAV.map((item) => (
 <NavLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} />
 ))}

 {admin ? (
 <>
 <button
 type="button"
 onClick={() => setWorkspaceOpen((v) => !v)}
 className={cn("mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-semibold uppercase tracking-widest text-[color:var(--text-muted)] hover:bg-[var(--bg-hover)]",
 collapsed && "justify-center px-0",
 )}
 aria-expanded={workspaceOpen}
 >
 {workspaceOpen ? (
 <ChevronDown className="size-3.5 shrink-0" />
 ) : (
 <ChevronRight className="size-3.5 shrink-0" />
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

 <button
 type="button"
 onClick={() => setDevNavOpen((v) => !v)}
 className={cn("mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-[11px] font-semibold uppercase tracking-widest text-[color:var(--text-muted)] hover:bg-[var(--bg-hover)]",
 collapsed && "justify-center px-0",
 )}
 aria-expanded={devNavOpen}
 >
 {devNavOpen ? (
 <ChevronDown className="size-3.5 shrink-0" />
 ) : (
 <ChevronRight className="size-3.5 shrink-0" />
 )}
 {!collapsed ? <span>Ferramentas internas</span> : null}
 </button>
 {devNavOpen
 ? DEV_ADMIN_NAV.map((item) => (
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

 <div className="space-y-2 border-t border-[color:var(--border-subtle)] p-2 pt-3">
 <LexSidebarThemeToggle collapsed={collapsed} />
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
 className={cn("relative flex min-h-[40px] items-center gap-3 rounded-md px-3 py-2.5 text-[14px] font-medium leading-snug transition-colors hover:bg-[var(--bg-hover)]",
 muted && !active && "text-[color:var(--text-muted)]",
 !muted && !active && "text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]",
 active &&
 "bg-[rgba(124,58,237,0.08)] text-[color:var(--violet-400)] before:absolute before:inset-y-1 before:left-0 before:w-0.5 before:rounded-r-sm before:bg-[var(--violet-500)] before:content-['']",
 collapsed && "justify-center px-0",
 )}
 >
 <Icon className={cn("size-4 shrink-0", active ? "opacity-100" : "opacity-80")} />
 {!collapsed ? item.label : null}
 </span>
 </Link>
 );
}
