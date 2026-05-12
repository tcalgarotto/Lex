"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import {
 DropdownMenu,
 DropdownMenuContent,
 DropdownMenuItem,
 DropdownMenuLabel,
 DropdownMenuSeparator,
 DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ROLE_LABEL } from "@/lib/auth/permissions";
import type { MembershipRole } from "@prisma/client";
import { cn } from "@/lib/utils";

export type WorkspaceOption = {
 id: string;
 name: string;
 role: MembershipRole;
};

export function WorkspaceSwitcher({
  current,
  workspaces,
  triggerClassName,
  layout = "inline",
  collapsed = false,
}: {
  current: WorkspaceOption;
  workspaces: WorkspaceOption[];
  /** Junta classes ao botão do trigger (ex.: header premium). */
  triggerClassName?: string;
  /** `sidebar`: largura total do footer; `inline`: largura limitada (ex.: header). */
  layout?: "inline" | "sidebar";
  /** Sidebar recolhida — só iniciais e chevron compactos. */
  collapsed?: boolean;
}) {
 const router = useRouter();
 const [pending, setPending] = useState<string | null>(null);

 async function switchTo(workspaceId: string) {
 if (workspaceId === current.id) return;
 setPending(workspaceId);
 try {
 const res = await fetch("/api/workspaces/active", {
 method: "POST",
 headers: { "content-type": "application/json" },
 body: JSON.stringify({ workspaceId }),
 });
 if (!res.ok) {
 const err = (await res.json().catch(() => ({}))) as { error?: string };
 toast.error(err.error ?? "Falha ao trocar de workspace.");
 return;
 }
 router.refresh();
 } finally {
 setPending(null);
 }
 }

 return (
 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button
 variant="ghost"
 size="sm"
 className={cn(
 "gap-2 truncate rounded-xl text-[color:var(--text-primary)]",
 layout === "sidebar" &&
 "h-auto min-h-[44px] w-full max-w-none justify-start px-2.5 py-2 text-sm font-medium",
 layout === "inline" &&
 "max-w-[min(22rem,42vw)] md:max-w-[min(24rem,36vw)] h-11 text-sm font-medium md:text-base",
 collapsed && layout === "sidebar" && "flex-col justify-center gap-1 px-0 py-2.5",
 triggerClassName,
 )}
 >
 <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-violet-600/35 text-xs font-semibold text-violet-100 md:size-7 md:text-sm">
 {current.name.charAt(0).toUpperCase()}
 </span>
 {!collapsed ? (
 <>
 <span className="min-w-0 flex-1 truncate text-left">{current.name}</span>
 <ChevronDown className="size-4 shrink-0 opacity-60" />
 </>
 ) : (
 <ChevronDown className="size-3.5 shrink-0 opacity-55" aria-hidden />
 )}
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent
 align="start"
 side={layout === "sidebar" ? "top" : "bottom"}
 sideOffset={layout === "sidebar" ? 6 : 4}
 className="w-72"
 >
 <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
 Seus workspaces
 </DropdownMenuLabel>
 <DropdownMenuSeparator />
 {workspaces.map((w) => (
 <DropdownMenuItem
 key={w.id}
 disabled={pending !== null}
 onSelect={(e) => {
 e.preventDefault();
 void switchTo(w.id);
 }}
 className="flex items-center justify-between gap-2"
 >
 <div className="min-w-0">
 <p className="truncate text-sm">{w.name}</p>
 <p className="text-[11px] text-muted-foreground">{ROLE_LABEL[w.role]}</p>
 </div>
 {w.id === current.id ? <Check className="size-4 text-violet-400" /> : null}
 </DropdownMenuItem>
 ))}
 </DropdownMenuContent>
 </DropdownMenu>
 );
}

/** Escritório único — mesmo visual do trigger, sem menu. */
export function WorkspaceSidebarLabel({
 name,
 collapsed,
}: {
 name: string;
 collapsed: boolean;
}) {
 const initial = name.charAt(0).toUpperCase();
 return (
 <div
 className={cn(
 "flex min-h-[44px] items-center gap-2 rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay-strong)]/40 px-2.5 py-2 text-sm font-medium text-[color:var(--text-secondary)]",
 collapsed && "flex-col justify-center px-0 py-2.5",
 )}
 title={name}
 >
 <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-violet-600/35 text-xs font-semibold text-violet-100 md:size-7 md:text-sm">
 {initial}
 </span>
 {!collapsed ? <span className="min-w-0 flex-1 truncate">{name}</span> : null}
 </div>
 );
}

/**
 * Lista de workspaces dentro de um painel estreito (ex.: menu da conta),
 * sem segundo DropdownMenu — evita fechar o menu pai ao trocar de escritório.
 */
export function WorkspacePickerPanel({
 current,
 workspaces,
}: {
 current: WorkspaceOption;
 workspaces: WorkspaceOption[];
}) {
 const router = useRouter();
 const [pending, setPending] = useState<string | null>(null);

 async function switchTo(workspaceId: string) {
 if (workspaceId === current.id) return;
 setPending(workspaceId);
 try {
 const res = await fetch("/api/workspaces/active", {
 method: "POST",
 headers: { "content-type": "application/json" },
 body: JSON.stringify({ workspaceId }),
 });
 if (!res.ok) {
 const err = (await res.json().catch(() => ({}))) as { error?: string };
 toast.error(err.error ?? "Falha ao trocar de workspace.");
 return;
 }
 router.refresh();
 } finally {
 setPending(null);
 }
 }

 if (workspaces.length <= 1) {
 const initial = current.name.charAt(0).toUpperCase();
 return (
 <div className="min-w-0 px-1">
 <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--text-muted)]">
 Escritório
 </p>
 <div
 className="flex min-h-[40px] items-center gap-2 rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay-strong)]/40 px-2 py-2 text-sm font-medium text-[color:var(--text-secondary)]"
 title={current.name}
 >
 <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-violet-600/35 text-xs font-semibold text-violet-100">
 {initial}
 </span>
 <span className="min-w-0 flex-1 truncate">{current.name}</span>
 </div>
 </div>
 );
 }

 return (
 <div className="min-w-0 px-1">
 <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--text-muted)]">
 Escritório
 </p>
 <div className="flex max-w-full flex-col gap-0.5">
 {workspaces.map((w) => {
 const active = w.id === current.id;
 return (
 <button
 key={w.id}
 type="button"
 disabled={pending !== null}
 onClick={() => void switchTo(w.id)}
 className={cn(
 "flex min-w-0 max-w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-sm font-medium lex-transition",
 active
 ? "bg-[color:var(--surface-overlay-strong)] text-[color:var(--text-primary)]"
 : "text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-overlay)] hover:text-[color:var(--text-primary)]",
 pending !== null && !active && "opacity-50",
 )}
 >
 <span className="flex min-w-0 flex-1 items-center gap-2">
 <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-violet-600/35 text-xs font-semibold text-violet-100">
 {w.name.charAt(0).toUpperCase()}
 </span>
 <span className="min-w-0 flex-1 truncate">{w.name}</span>
 </span>
 {active ? <Check className="size-4 shrink-0 text-violet-400" aria-hidden /> : null}
 </button>
 );
 })}
 </div>
 </div>
 );
}
