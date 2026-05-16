import { NextResponse } from "next/server";
import { z } from "zod";
import { BetaLeadStatus } from "@prisma/client";
import { requireBetaLeadsAdmin } from "@/lib/auth/beta-leads-admin";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
  status: z.nativeEnum(BetaLeadStatus).optional(),
  notes: z.string().trim().max(5000).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireBetaLeadsAdmin();
  const { id } = await params;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const { status, notes } = parsed.data;
  if (status === undefined && notes === undefined) {
    return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
  }

  const existing = await prisma.betaLeadRequest.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
  }

  const contactedAt =
    status === BetaLeadStatus.CONTACTED || status === BetaLeadStatus.QUALIFIED
      ? existing.contactedAt ?? new Date()
      : status === BetaLeadStatus.NEW
        ? null
        : existing.contactedAt;

  const updated = await prisma.betaLeadRequest.update({
    where: { id },
    data: {
      ...(status !== undefined ? { status, contactedAt } : {}),
      ...(notes !== undefined ? { notes: notes || null } : {}),
    },
    select: {
      id: true,
      status: true,
      notes: true,
      contactedAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ lead: updated });
}
