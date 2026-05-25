"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import {
  ChevronsUpDown,
  HelpCircle,
  LogOut,
  PenLine,
  Settings,
  User,
  Users,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { hasAtLeast, ROLE_LABEL } from "@/lib/auth/permissions";
import { MembershipRole } from "@prisma/client";
import { cn } from "@/lib/utils";
import type { SidebarViewer } from "@/components/app/workspace-context";
import type { WorkspaceOption } from "@/components/app/workspace-switcher";
import { WorkspacePickerPanel } from "@/components/app/workspace-switcher";
import { LexSidebarThemeToggle } from "@/components/ui/theme-toggle";

function initialsFrom(name: string, email: string): string {
  const n = name.trim();
  if (n.length >= 2) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  }
  const local = email.split("@")[0] ?? "?";
  return local.slice(0, 2).toUpperCase();
}

export function SidebarAccountFooter({
  viewer,
  role,
  collapsed,
  workspace,
}: {
  viewer: SidebarViewer;
  role: MembershipRole;
  collapsed: boolean;
  workspace: { current: WorkspaceOption; workspaces: WorkspaceOption[] } | null;
}) {
  const router = useRouter();
  const admin = hasAtLeast(role, MembershipRole.ADMIN);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [panelWidth, setPanelWidth] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    if (!open || !wrapRef.current) return;
    const w = Math.floor(wrapRef.current.getBoundingClientRect().width);
    if (w > 0) setPanelWidth(w);
  }, [open]);

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const initials = initialsFrom(viewer.displayName, viewer.email);
  const roleLabel = ROLE_LABEL[role];

  const avatarEl =
    viewer.avatarUrl && viewer.avatarUrl.startsWith("http") ? (
      <Image
        src={viewer.avatarUrl}
        alt=""
        width={36}
        height={36}
        className="size-9 shrink-0 rounded-full object-cover ring-1 ring-white/10"
        unoptimized
      />
    ) : (
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 text-sm font-semibold text-white shadow-inner ring-1 ring-white/10"
        aria-hidden
      >
        {initials}
      </span>
    );

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setPanelWidth(undefined);
      }}
    >
      <div ref={wrapRef} className="w-full min-w-0">
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className={cn(
              "h-auto min-h-[3rem] w-full min-w-0 justify-start gap-2 rounded-xl px-2 py-2 text-left font-normal",
              "text-[color:var(--text-primary)] hover:bg-[color:var(--surface-overlay-strong)]",
              collapsed && "justify-center px-0",
            )}
          >
            {avatarEl}
            {!collapsed ? (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-medium leading-snug">{viewer.displayName}</p>
                  <p className="truncate text-sm font-medium leading-snug text-[color:var(--text-secondary)]">{roleLabel}</p>
                </div>
                <ChevronsUpDown className="size-4 shrink-0 text-[color:var(--text-muted)]" aria-hidden />
              </>
            ) : null}
          </Button>
        </DropdownMenuTrigger>
      </div>
      <DropdownMenuContent
        side="top"
        align="start"
        sideOffset={8}
        avoidCollisions
        collisionPadding={8}
        style={panelWidth ? { width: panelWidth, maxWidth: "100%" } : undefined}
        className={cn(
          "!min-w-0 max-w-none rounded-xl border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] p-1.5 shadow-xl",
          "box-border",
        )}
      >
        <div className="min-w-0 max-w-full px-1 pb-2 pt-0.5">
          <p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
            Tema da interface
          </p>
          <LexSidebarThemeToggle collapsed={false} compact />
        </div>
        {workspace ? (
          <>
            <DropdownMenuSeparator className="bg-[color:var(--border-subtle)]" />
            <WorkspacePickerPanel current={workspace.current} workspaces={workspace.workspaces} />
          </>
        ) : null}
        <DropdownMenuSeparator className="bg-[color:var(--border-subtle)]" />
        <DropdownMenuItem asChild className="cursor-pointer rounded-lg py-2.5 text-base">
          <Link href="/settings/perfil" className="flex items-center gap-3">
            <User className="size-5 shrink-0 opacity-80" />
            Perfil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer rounded-lg py-2.5 text-base">
          <Link href="/settings/perfil" className="flex items-center gap-3">
            <Settings className="size-5 shrink-0 opacity-80" />
            Configurações
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="cursor-pointer rounded-lg py-2.5 text-base">
          <Link href="/settings/estilo" className="flex items-center gap-3">
            <PenLine className="size-5 shrink-0 opacity-80" />
            Estilo da escrita
          </Link>
        </DropdownMenuItem>
        {admin ? (
          <DropdownMenuItem asChild className="cursor-pointer rounded-lg py-2.5 text-base">
            <Link href="/settings/team" className="flex items-center gap-3">
              <Users className="size-5 shrink-0 opacity-80" />
              Equipe
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator className="bg-[color:var(--border-subtle)]" />
        <DropdownMenuItem asChild className="cursor-pointer rounded-lg py-2.5 text-base">
          <Link href="/test-guide" className="flex items-center gap-3">
            <HelpCircle className="size-5 shrink-0 opacity-80" />
            Guia do JustOS
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-[color:var(--border-subtle)]" />
        <DropdownMenuItem
          className="cursor-pointer rounded-lg py-2.5 text-base text-rose-400 focus:bg-rose-500/10 focus:text-rose-300"
          onSelect={(e) => {
            e.preventDefault();
            void signOut();
          }}
        >
          <LogOut className="size-5 shrink-0 opacity-90" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
