import { NextResponse } from "next/server";
import { z } from "zod";
import { MembershipRole } from "@prisma/client";
import { requirePermission } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { createOrRefreshInvitation } from "@/lib/auth/invitations";
import { WorkspaceSeatLimitReachedError } from "@/lib/auth/workspace-seats";
import { rateLimit, rateLimitHeaders, rateLimitHttpStatus } from "@/lib/rate-limit";

export const runtime = "nodejs";

const createSchema = z.object({
  email: z.string().email(),
  role: z.nativeEnum(MembershipRole).default(MembershipRole.LAWYER),
});

export async function POST(req: Request) {
  const { workspaceId, user } = await requirePermission("membersInvite");
  const rl = await rateLimit({
    key: `invite:${workspaceId}`,
    limit: 30,
    windowSeconds: 60,
    tier: "expensive",
  });
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error:
          rateLimitHttpStatus(rl) === 503
            ? "Convites temporariamente indisponíveis."
            : "Muitos convites em pouco tempo. Aguarde um instante.",
      },
      { status: rateLimitHttpStatus(rl), headers: rateLimitHeaders(rl) },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const { email, role } = parsed.data;

  // Bloqueia auto-promoção para OWNER por convite (OWNER só por transferência explícita)
  if (role === MembershipRole.OWNER) {
    return NextResponse.json(
      { error: "Não é possível convidar diretamente como OWNER." },
      { status: 400 },
    );
  }

  // Se já é membro, não convida — orienta a usar troca de role.
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const m = await prisma.membership.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: existingUser.id } },
    });
    if (m) {
      return NextResponse.json(
        { error: "Esta pessoa já é membro do workspace." },
        { status: 409 },
      );
    }
  }

  let inv: Awaited<ReturnType<typeof createOrRefreshInvitation>>;
  try {
    inv = await createOrRefreshInvitation({
      workspaceId,
      email,
      role,
      invitedById: user.id,
    });
  } catch (e) {
    if (e instanceof WorkspaceSeatLimitReachedError) {
      return NextResponse.json({ error: e.message }, { status: 403, headers: rateLimitHeaders(rl) });
    }
    throw e;
  }

  await prisma.activity.create({
    data: {
      workspaceId,
      kind: "team.invite.sent",
      title: `Convite enviado para ${email} (${role})`,
      metaJson: { invitationId: inv.id, email, role },
    },
  });

  const appUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000";
  const link = `${appUrl}/invite/${inv.token}`;

  return NextResponse.json(
    {
      id: inv.id,
      email,
      role,
      expiresAt: inv.expiresAt,
      link,
      isNew: inv.isNew,
    },
    { headers: rateLimitHeaders(rl) },
  );
}

export async function GET() {
  const { workspaceId } = await requirePermission("membersInvite");
  const invitations = await prisma.invitation.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ invitations });
}
