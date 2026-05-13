import { CourtConnectionAuthType, CourtConnectorStatus, CourtConnectorType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getCourtConnectorDefinition } from "@/lib/court-connectors/registry";

const Body = z.object({
  provider: z.nativeEnum(CourtConnectorType),
});

export async function POST(req: Request) {
  const { workspaceId, user } = await getWorkspaceContext();
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Payload inválido" }, { status: 400 });

  const isDataJud = parsed.data.provider === CourtConnectorType.DATAJUD_PUBLIC;
  const definition = getCourtConnectorDefinition(parsed.data.provider);
  const status = isDataJud ? CourtConnectorStatus.active : definition?.status ?? CourtConnectorStatus.requires_official_authorization;
  const authType = isDataJud ? CourtConnectionAuthType.NONE : definition?.authType ?? CourtConnectionAuthType.OFFICIAL_TOKEN;
  const connection = await prisma.courtConnection.upsert({
    where: { workspaceId_provider: { workspaceId, provider: parsed.data.provider } },
    update: {
      status,
      authType,
      revokedAt: null,
      lastConnectedAt: isDataJud ? new Date() : null,
    },
    create: {
      workspaceId,
      provider: parsed.data.provider,
      status,
      authType,
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
      metadataJson: { provider: connection.provider, officialOnly: !isDataJud, manualBridge: definition?.requiresHumanAction ?? false },
    },
  });
  return NextResponse.json({ connection });
}
