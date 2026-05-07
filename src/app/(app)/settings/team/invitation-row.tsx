"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, X } from "lucide-react";
import { MembershipRole } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABEL } from "@/lib/auth/permissions";

export function InvitationRow({
  invitation,
}: {
  invitation: {
    id: string;
    email: string;
    role: MembershipRole;
    token: string;
    expiresAt: string;
    createdAt: string;
  };
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function copyLink() {
    const origin = window.location.origin;
    const link = `${origin}/invite/${invitation.token}`;
    await navigator.clipboard.writeText(link);
    toast.success("Link copiado.");
  }

  async function revoke() {
    if (!confirm(`Revogar convite de ${invitation.email}?`)) return;
    setPending(true);
    try {
      const res = await fetch(`/api/invitations/${invitation.id}`, { method: "DELETE" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Falha ao revogar.");
        return;
      }
      toast.success("Convite revogado.");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/5 px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{invitation.email}</p>
        <p className="text-xs text-muted-foreground">
          convidado {invitation.createdAt} ·{" "}
          <span className="text-zinc-300">{ROLE_LABEL[invitation.role]}</span>
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[10px]">
          pendente
        </Badge>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={() => void copyLink()}
          aria-label="Copiar link"
        >
          <Copy className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-zinc-400 hover:text-red-300"
          disabled={pending}
          onClick={() => void revoke()}
          aria-label="Revogar convite"
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
