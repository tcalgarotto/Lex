import { notFound } from "next/navigation";
import { InvitationStatus } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AppShell } from "@/components/app/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getWorkspaceContextWithRole } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { ROLE_LABEL, can } from "@/lib/auth/permissions";
import { InviteMemberForm } from "./invite-form";
import { MemberRow } from "./member-row";
import { InvitationRow } from "./invitation-row";

export default async function TeamPage() {
  const { workspaceId, role, user } = await getWorkspaceContextWithRole();
  if (!role) notFound();
  const allowedToManage = can(role, "membersInvite");

  const [members, invitations] = await Promise.all([
    prisma.membership.findMany({
      where: { workspaceId },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.invitation.findMany({
      where: { workspaceId, status: InvitationStatus.PENDING },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <AppShell title="Equipe">
      <div className="space-y-6">
        {allowedToManage ? (
          <Card className="border-white/10 bg-zinc-900/40">
            <CardHeader>
              <CardTitle className="text-base">Convidar pessoa</CardTitle>
              <CardDescription>
                Enviamos um link de convite. A pessoa precisa criar conta com o mesmo e-mail
                ou fazer login para aceitar.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InviteMemberForm currentUserRole={role} />
            </CardContent>
          </Card>
        ) : null}

        <Card className="border-white/10 bg-zinc-900/40">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Membros</CardTitle>
              <CardDescription>
                {members.length} {members.length === 1 ? "pessoa" : "pessoas"} no workspace.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-[10px]">
              Você: {ROLE_LABEL[role]}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-2">
            {members.map((m) => (
              <MemberRow
                key={m.id}
                membership={{
                  id: m.id,
                  userId: m.userId,
                  email: m.user.email,
                  name: m.user.name,
                  role: m.role,
                  joinedAt: m.createdAt.toISOString(),
                }}
                isSelf={m.userId === user.id}
                canManage={allowedToManage && m.userId !== user.id}
                currentUserRole={role}
              />
            ))}
          </CardContent>
        </Card>

        {allowedToManage ? (
          <Card className="border-white/10 bg-zinc-900/40">
            <CardHeader>
              <CardTitle className="text-base">Convites pendentes</CardTitle>
              <CardDescription>
                Links válidos por 7 dias. Você pode revogar a qualquer momento.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {invitations.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum convite pendente.</p>
              ) : (
                invitations.map((inv) => (
                  <InvitationRow
                    key={inv.id}
                    invitation={{
                      id: inv.id,
                      email: inv.email,
                      role: inv.role,
                      token: inv.token,
                      expiresAt: inv.expiresAt.toISOString(),
                      createdAt: formatDistanceToNow(inv.createdAt, {
                        addSuffix: true,
                        locale: ptBR,
                      }),
                    }}
                  />
                ))
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}
