/**
 * GET  /api/integrations         — lista integrações do workspace.
 * POST /api/integrations         — cria/conecta uma integração (sem segredo cru).
 *
 * Auth: requer sessão + workspace ativo.
 * Multi-tenant: workspaceId obrigatório.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import {
  IntegrationProvider,
  IntegrationStatus,
  Prisma,
} from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getAdapter } from "@/lib/integrations/registry";

export const dynamic = "force-dynamic";

const PostBody = z.object({
  provider: z.nativeEnum(IntegrationProvider),
  label: z.string().min(2).max(120),
  configJson: z.record(z.unknown()).optional(),
  /** Apenas referência para um cofre (env var, vault key). Nunca segredo cru. */
  secretRef: z.string().min(2).max(200).optional(),
});

export async function GET() {
  const { workspaceId } = await getWorkspaceContext();
  const integrations = await prisma.integration.findMany({
    where: { workspaceId },
    orderBy: [{ provider: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ integrations });
}

export async function POST(req: Request) {
  const { workspaceId } = await getWorkspaceContext();
  let body: z.infer<typeof PostBody>;
  try {
    body = PostBody.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: "Payload inválido", detail: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }

  const adapter = getAdapter(body.provider);
  const ctx = {
    workspaceId,
    ...(body.secretRef ? { secretRef: body.secretRef } : {}),
    ...(body.configJson ? { config: body.configJson } : {}),
  };
  const health = await adapter.health(ctx);
  const status: IntegrationStatus = health.ok
    ? IntegrationStatus.CONNECTED
    : IntegrationStatus.ERROR;

  try {
    const created = await prisma.integration.create({
      data: {
        workspaceId,
        provider: body.provider,
        label: body.label,
        status,
        ...(body.configJson
          ? { configJson: body.configJson as Prisma.InputJsonValue }
          : {}),
        ...(body.secretRef ? { secretRef: body.secretRef } : {}),
        ...(health.ok ? {} : { lastError: health.message }),
      },
    });
    return NextResponse.json({ integration: created, health }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { error: `Já existe integração ${body.provider} com label "${body.label}".` },
        { status: 409 },
      );
    }
    throw e;
  }
}
