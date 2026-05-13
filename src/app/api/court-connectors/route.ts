import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getCourtConnectorDefinitions } from "@/lib/court-connectors/registry";

export async function GET() {
  const { workspaceId } = await getWorkspaceContext();
  const connections = await prisma.courtConnection.findMany({
    where: { workspaceId },
    select: { provider: true, status: true, authType: true, lastConnectedAt: true, revokedAt: true },
  });
  return NextResponse.json({
    connectors: getCourtConnectorDefinitions().map((connector) => ({
      ...connector,
      connection: connections.find((c) => c.provider === connector.provider) ?? null,
    })),
  });
}
