import Link from "next/link";
import { MembershipRole } from "@prisma/client";
import { getWorkspaceContextWithRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function PerfilPage() {
 const { user, role } = await getWorkspaceContextWithRole();
 const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
 const memberships = await prisma.membership.findMany({
 where: { userId: user.id },
 include: { workspace: true },
 });

 return (
 <Card className="w-full ">
 <CardHeader>
 <CardTitle className="text-base">Conta</CardTitle>
 </CardHeader>
 <CardContent className="space-y-2 text-sm">
 {role === MembershipRole.OWNER ? (
 <div className="pb-2">
 <Button asChild variant="secondary" size="sm" className="border-[color:var(--border-default)] bg-white/5">
 <Link href="/settings/admin">Admin — custos e observabilidade</Link>
 </Button>
 </div>
 ) : null}
 <p>
 <span className="text-muted-foreground">Nome:</span> {dbUser?.name ?? "—"}
 </p>
 <p>
 <span className="text-muted-foreground">E-mail:</span> {dbUser?.email}
 </p>
 <p className="pt-2 text-muted-foreground">Workspaces (RBAC preparado):</p>
 <ul className="list-inside list-disc text-muted-foreground">
 {memberships.map((m) => (
 <li key={m.id}>
 {m.workspace.name} — {m.role}
 </li>
 ))}
 </ul>
 </CardContent>
 </Card>
 );
}
