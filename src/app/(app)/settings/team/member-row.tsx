"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { MembershipRole } from "@prisma/client";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABEL } from "@/lib/auth/permissions";

const ASSIGNABLE: MembershipRole[] = [
 MembershipRole.ADMIN,
 MembershipRole.LAWYER,
 MembershipRole.ASSISTANT,
 MembershipRole.CLIENT,
];

export function MemberRow({
 membership,
 isSelf,
 canManage,
 currentUserRole,
}: {
 membership: {
 id: string;
 userId: string;
 email: string;
 name: string | null;
 role: MembershipRole;
 joinedAt: string;
 };
 isSelf: boolean;
 canManage: boolean;
 currentUserRole: MembershipRole;
}) {
 const router = useRouter();
 const [pending, setPending] = useState(false);

 const isOwnerRow = membership.role === MembershipRole.OWNER;
 // OWNER só altera quem não é OWNER. ADMIN não altera ADMIN nem OWNER.
 const allowed =
 canManage &&
 !isOwnerRow &&
 !(currentUserRole === MembershipRole.ADMIN && membership.role === MembershipRole.ADMIN);

 async function changeRole(role: MembershipRole) {
 if (role === membership.role) return;
 setPending(true);
 try {
 const res = await fetch(`/api/memberships/${membership.id}`, {
 method: "PATCH",
 headers: { "content-type": "application/json" },
 body: JSON.stringify({ role }),
 });
 const data = (await res.json()) as { error?: string };
 if (!res.ok) {
 toast.error(data.error ?? "Falha ao alterar função.");
 return;
 }
 toast.success("Função atualizada.");
 router.refresh();
 } finally {
 setPending(false);
 }
 }

 async function remove() {
 if (!confirm(`Remover ${membership.email} do workspace?`)) return;
 setPending(true);
 try {
 const res = await fetch(`/api/memberships/${membership.id}`, { method: "DELETE" });
 const data = (await res.json()) as { error?: string };
 if (!res.ok) {
 toast.error(data.error ?? "Falha ao remover.");
 return;
 }
 toast.success("Membro removido.");
 router.refresh();
 } finally {
 setPending(false);
 }
 }

 return (
 <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[color:var(--border-subtle)] px-3 py-2">
 <div className="min-w-0">
 <p className="truncate text-sm font-medium">
 {membership.name ?? membership.email}
 {isSelf ? (
 <Badge variant="outline" className="ml-2 text-[10px]">
 você
 </Badge>
 ) : null}
 </p>
 {membership.name ? (
 <p className="truncate text-xs text-muted-foreground">{membership.email}</p>
 ) : null}
 </div>
 <div className="flex items-center gap-2">
 {allowed ? (
 <select
 value={membership.role}
 disabled={pending}
 onChange={(e) => void changeRole(e.target.value as MembershipRole)}
 className="h-8 rounded-md border border-[color:var(--border-default)] bg-[color:var(--surface-elevated)] px-2 text-xs"
 >
 {ASSIGNABLE.map((r) => (
 <option key={r} value={r}>
 {ROLE_LABEL[r]}
 </option>
 ))}
 </select>
 ) : (
 <Badge variant="secondary" className="text-[10px]">
 {ROLE_LABEL[membership.role]}
 </Badge>
 )}
 {allowed ? (
 <Button
 variant="ghost"
 size="icon"
 className="size-8 text-[color:var(--text-secondary)] hover:text-red-300"
 disabled={pending}
 onClick={() => void remove()}
 aria-label={`Remover ${membership.email}`}
 >
 <Trash2 className="size-4" />
 </Button>
 ) : null}
 </div>
 </div>
 );
}
