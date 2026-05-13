import { CourtConnectionAuthType, CourtConnectorStatus, CourtConnectorType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const Body = z.object({
  provider: z.nativeEnum(CourtConnectorType),
});

export async function POST(req: Request) {
  const { workspaceId, user } = await getWorkspaceContext();
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Payload inválido" }, { status: 400 });

  const isDataJud = parsed.data.provider === CourtConnectorType.DATAJUD_PUBLIC;
  const connection = await prisma.courtConnection.upsert({
    where: { workspaceId_provider: { workspaceId, provider: parsed.data.provider } },
    update: {
      status: isDataJud ? CourtConnectorStatus.active : CourtConnectorStatus.requires_official_authorization,
      authType: isDataJud ? CourtConnectionAuthType.NONE : CourtConnectionAuthType.OFFICIAL_TOKEN,
      revokedAt: null,
      lastConnectedAt: isDataJud ? new Date() : null,
    },
    create: {
      workspaceId,
      provider: parsed.data.provider,
      status: isDataJud ? CourtConnectorStatus.active : CourtConnectorStatus.requires_official_authorization,
      authType: isDataJud ? CourtConnectionAuthType.NONE : CourtConnectionAuthType.OFFICIAL_TOKEN,
      createdByUserId: user.id,
      lastConnectedAt: isDataJud ? new Date() : null,
    },
  });
  await prisma.courtConnectionAuditLog.create({
    data: {
      workspaceId,
      connectionId: connection.id,
      action: "start",
      status: connection.status,
      metadataJson: { provider: connection.provider, officialOnly: !isDataJud },
    },
  });
  return NextResponse.json({ connection });
}
