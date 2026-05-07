import { redirect } from "next/navigation";
import Link from "next/link";
import { InvitationStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ROLE_LABEL } from "@/lib/auth/permissions";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth/session";
import { AcceptInviteForm } from "./accept-form";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const inv = await prisma.invitation.findUnique({
    where: { token },
    include: { workspace: { select: { name: true, slug: true } } },
  });

  const user = await getAuthUser();

  // Se não está logado, manda pra login com next= para voltar aqui
  if (!user) {
    const next = encodeURIComponent(`/invite/${token}`);
    redirect(`/login?next=${next}`);
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_top,_rgba(139,92,246,0.15),transparent_50%)] px-4">
      <Card className="relative z-10 w-full max-w-md border-white/10 bg-zinc-950/80 backdrop-blur-xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl tracking-tight">Convite de equipe</CardTitle>
          <CardDescription>
            {inv ? `Você foi convidado para ${inv.workspace.name}.` : "Convite inválido."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!inv ? (
            <InvalidInvite />
          ) : inv.status === InvitationStatus.REVOKED ? (
            <Message
              title="Convite revogado"
              detail="Este convite foi cancelado pelo administrador do workspace."
            />
          ) : inv.status === InvitationStatus.ACCEPTED ? (
            <Message
              title="Convite já aceito"
              detail="Você já faz parte deste workspace."
              ctaHref="/dashboard"
              ctaLabel="Ir para o dashboard"
            />
          ) : inv.expiresAt.getTime() < Date.now() ? (
            <Message
              title="Convite expirado"
              detail="Peça ao administrador para gerar um novo convite."
            />
          ) : inv.email.toLowerCase() !== (user.email ?? "").toLowerCase() ? (
            <div className="space-y-4 text-sm text-zinc-300">
              <p>
                Este convite foi emitido para{" "}
                <span className="font-medium text-zinc-100">{inv.email}</span>, mas você está
                logado como{" "}
                <span className="font-medium text-zinc-100">{user.email}</span>.
              </p>
              <p className="text-xs text-zinc-500">
                Faça logout e entre com o e-mail certo para aceitar.
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link href="/login">Trocar de conta</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4 text-sm text-zinc-300">
              <p>
                Você entrará em{" "}
                <span className="font-medium text-zinc-100">{inv.workspace.name}</span> como{" "}
                <span className="font-medium text-violet-300">{ROLE_LABEL[inv.role]}</span>.
              </p>
              <AcceptInviteForm token={token} />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Message({
  title,
  detail,
  ctaHref,
  ctaLabel,
}: {
  title: string;
  detail: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div className="space-y-4 text-sm text-zinc-300">
      <p className="font-medium text-zinc-100">{title}</p>
      <p>{detail}</p>
      {ctaHref ? (
        <Button asChild className="w-full">
          <Link href={ctaHref}>{ctaLabel ?? "Continuar"}</Link>
        </Button>
      ) : (
        <Button asChild variant="outline" className="w-full">
          <Link href="/dashboard">Voltar</Link>
        </Button>
      )}
    </div>
  );
}

function InvalidInvite() {
  return (
    <div className="space-y-4 text-sm text-zinc-300">
      <p>Não encontramos esse convite. O link pode estar incorreto ou ter sido revogado.</p>
      <Button asChild variant="outline" className="w-full">
        <Link href="/dashboard">Ir para o dashboard</Link>
      </Button>
    </div>
  );
}
