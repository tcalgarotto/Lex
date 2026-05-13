import { CourtConnectorStatus, CourtConnectorType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const Body = z.object({
  provider: z.nativeEnum(CourtConnectorType),
});

export async function POST(req: Request) {
  const { workspaceId } = await getWorkspaceContext();
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Payload inválido" }, { status: 400 });

  const connection = await prisma.courtConnection.update({
    where: { workspaceId_provider: { workspaceId, provider: parsed.data.provider } },
    data: {
      status: CourtConnectorStatus.disabled,
      encryptedToken: null,
      revokedAt: new Date(),
    },
  });
  await prisma.courtConnectionAuditLog.create({
    data: {
      workspaceId,
      connectionId: connection.id,
      action: "revoke",
      status: connection.status,
      metadataJson: { provider: connection.provider },
    },
  });
  return NextResponse.json({ connection });
}
