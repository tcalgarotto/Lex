/**
 * POST /api/cases/[id]/justos-notification-log
 * Auditoria de notificações WhatsApp (substitui PG Log no n8n).
 * Auth: Bearer LEX_N8N_SERVICE_TOKEN.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { isLexN8nServiceAuthorized } from "@/lib/justos/n8n-auth";
import {
  appendCaseNotificationLog,
  assertNotificationRecipientAuthorized,
} from "@/lib/justos/n8n-secretary-store";
import { prisma } from "@/lib/prisma";

const PostBody = z.object({
  event: z.string().min(1).max(120),
  channel: z.string().min(1).max(32),
  to: z.string().min(1).max(32),
  traceId: z.string().min(1).max(120),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isLexN8nServiceAuthorized(req)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id: caseId } = await params;
  let body: z.infer<typeof PostBody>;
  try {
    body = PostBody.parse(await req.json());
  } catch (e) {
    return NextResponse.json(
      { error: "Payload inválido", detail: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }

  const row = await prisma.case.findFirst({
    where: { id: caseId, deletedAt: null },
    select: { workspaceId: true },
  });
  if (!row) {
    return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
  }

  try {
    await assertNotificationRecipientAuthorized({
      workspaceId: row.workspaceId,
      caseId,
      to: body.to,
    });
  } catch (e) {
    const status = (e as { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status },
    );
  }

  await appendCaseNotificationLog({
    workspaceId: row.workspaceId,
    caseId,
    event: body.event,
    channel: body.channel,
    to: body.to,
    traceId: body.traceId,
  });

  return NextResponse.json({ ok: true });
}
