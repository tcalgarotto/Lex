"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { MembershipRole } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_LABEL, hasAtLeast } from "@/lib/auth/permissions";

const ASSIGNABLE_ROLES: MembershipRole[] = [
 MembershipRole.ADMIN,
 MembershipRole.LAWYER,
 MembershipRole.ASSISTANT,
 MembershipRole.CLIENT,
];

export function InviteMemberForm({
 currentUserRole,
 inviteBlocked = false,
}: {
 currentUserRole: MembershipRole;
 /** Limite de lugares do plano atingido (membros + pendentes). */
 inviteBlocked?: boolean;
}) {
 const router = useRouter();
 const [email, setEmail] = useState("");
 const [role, setRole] = useState<MembershipRole>(MembershipRole.LAWYER);
 const [loading, setLoading] = useState(false);

 // Não mostra ADMIN se quem convida não é OWNER (evita escalada lateral)
 const availableRoles = ASSIGNABLE_ROLES.filter((r) => {
 if (r === MembershipRole.ADMIN) {
 return currentUserRole === MembershipRole.OWNER;
 }
 return hasAtLeast(currentUserRole, MembershipRole.ADMIN);
 });

 async function onSubmit(e: React.FormEvent) {
 e.preventDefault();
 if (inviteBlocked) return;
 setLoading(true);
 try {
 const res = await fetch("/api/invitations", {
 method: "POST",
 headers: { "content-type": "application/json" },
 body: JSON.stringify({ email, role }),
 });
 const data = (await res.json()) as { error?: string; link?: string };
 if (!res.ok) {
 toast.error(data.error ?? "Falha ao convidar.");
 return;
 }
 if (data.link) {
 await navigator.clipboard.writeText(data.link).catch(() => {});
 toast.success(`Convite criado. Link copiado para a área de transferência.`);
 } else {
 toast.success("Convite criado.");
 }
 setEmail("");
 router.refresh();
 } catch (err) {
 toast.error(err instanceof Error ? err.message : "Erro de rede");
 } finally {
 setLoading(false);
 }
 }

 return (
 <form className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end" onSubmit={onSubmit}>
 {inviteBlocked ? (
 <p className="sm:col-span-3 text-sm text-amber-700 dark:text-amber-400">
 Limite de lugares do plano atingido. Remova um membro ou um convite pendente para convidar outra pessoa.
 </p>
 ) : null}
 <div className="space-y-1">
 <Label htmlFor="invite-email">E-mail</Label>
 <Input
 id="invite-email"
 type="email"
 required
 value={email}
 placeholder="colega@escritorio.com"
 onChange={(e) => setEmail(e.target.value)}
 />
 </div>
 <div className="space-y-1">
 <Label htmlFor="invite-role">Função</Label>
 <select
 id="invite-role"
 value={role}
 onChange={(e) => setRole(e.target.value as MembershipRole)}
 className="h-9 rounded-md border border-[color:var(--border-default)] bg-[color:var(--surface-elevated)] px-2 text-sm"
 >
 {availableRoles.map((r) => (
 <option key={r} value={r}>
 {ROLE_LABEL[r]}
 </option>
 ))}
 </select>
 </div>
 <Button type="submit" disabled={loading || inviteBlocked}>
 {loading ? "Convidando…" : "Convidar"}
 </Button>
 </form>
 );
}
