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

export type WorkspaceOption = {
  id: string;
  name: string;
  role: MembershipRole;
};

export function WorkspaceSwitcher({
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="max-w-[220px] gap-2 truncate text-zinc-200"
        >
          <span className="flex size-5 shrink-0 items-center justify-center rounded bg-violet-600/30 text-[10px] font-semibold text-violet-200">
            {current.name.charAt(0).toUpperCase()}
          </span>
          <span className="truncate text-sm">{current.name}</span>
          <ChevronDown className="size-3.5 shrink-0 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
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
