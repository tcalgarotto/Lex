import { CourtConnectionAuthType, CourtConnectorStatus, CourtConnectorType } from "@prisma/client";
import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const CONNECTORS = [
  {
    provider: CourtConnectorType.DATAJUD_PUBLIC,
    name: "DataJud Público",
    status: CourtConnectorStatus.active,
    authType: CourtConnectionAuthType.NONE,
    description: "Metadados públicos, capa e movimentações. Não substitui intimação oficial.",
  },
  {
    provider: CourtConnectorType.ESCRITORIO_DIGITAL,
    name: "Escritório Digital",
    status: CourtConnectorStatus.requires_official_authorization,
    authType: CourtConnectionAuthType.OFFICIAL_OAUTH,
    description: "Preparado para integração oficial futura. Sem scraping e sem senha armazenada.",
  },
  {
    provider: CourtConnectorType.MNI,
    name: "MNI",
    status: CourtConnectorStatus.requires_official_authorization,
    authType: CourtConnectionAuthType.OFFICIAL_TOKEN,
    description: "Camada oficial para integrações judiciais quando autorizada pelo tribunal.",
  },
  {
    provider: CourtConnectorType.PJE,
    name: "PJe",
    status: CourtConnectorStatus.planned,
    authType: CourtConnectionAuthType.CERTIFICATE_TOKEN,
    description: "Conector preparado apenas para caminho oficial, sem automação de login.",
  },
  {
    provider: CourtConnectorType.ESAJ,
    name: "e-SAJ",
    status: CourtConnectorStatus.planned,
    authType: CourtConnectionAuthType.OFFICIAL_TOKEN,
    description: "Sem scraping, captcha bypass, MFA bypass ou armazenamento de credenciais.",
  },
] as const;

export async function GET() {
  const { workspaceId } = await getWorkspaceContext();
  const connections = await prisma.courtConnection.findMany({
    where: { workspaceId },
    select: { provider: true, status: true, authType: true, lastConnectedAt: true, revokedAt: true },
  });
  return NextResponse.json({
    connectors: CONNECTORS.map((connector) => ({
      ...connector,
      connection: connections.find((c) => c.provider === connector.provider) ?? null,
    })),
  });
}
