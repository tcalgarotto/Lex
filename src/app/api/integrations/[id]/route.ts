/**
 * PATCH  /api/integrations/[id] — pausa/retoma/atualiza configuração.
 * DELETE /api/integrations/[id] — remove integração.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { IntegrationStatus, Prisma } from "@prisma/client";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const PatchBody = z.object({
  status: z.nativeEnum(IntegrationStatus).optional(),
  configJson: z.record(z.unknown()).optional(),
  label: z.string().min(2).max(120).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { workspaceId } = await getWorkspaceContext();
  const { id } = await params;
  let body: z.infer<typeof PatchBody>;
  try {
    body = PatchBody.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: "Payload inválido", detail: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }

  const integration = await prisma.integration.findFirst({
    where: { id, workspaceId },
    select: { id: true },
  });
  if (!integration) {
    return NextResponse.json({ error: "Integração não encontrada" }, { status: 404 });
  }

  const data: Prisma.IntegrationUpdateInput = {};
  if (body.status) data.status = body.status;
  if (body.label) data.label = body.label;
  if (body.configJson) data.configJson = body.configJson as Prisma.InputJsonValue;

  const updated = await prisma.integration.update({
    where: { id: integration.id },
    data,
  });
  return NextResponse.json({ integration: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { workspaceId } = await getWorkspaceContext();
  const { id } = await params;
  const result = await prisma.integration.deleteMany({
    where: { id, workspaceId },
  });
  if (!result.count) {
    return NextResponse.json({ error: "Integração não encontrada" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
