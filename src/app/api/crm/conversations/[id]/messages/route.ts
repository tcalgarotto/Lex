import { NextResponse } from "next/server";
import { z } from "zod";
import { CrmMessageDirection } from "@prisma/client";
import { isJustosCrmWaSendEnabled } from "@/lib/justos/env";
import { sendViaJustosCommand } from "@/lib/justos/command-client";
import {
  appendCrmMessage,
  getCrmApiContext,
  getCrmConversation,
  getCrmConversationMessages,
  handleCrmRouteError,
} from "@/lib/justos/crm";
import { AppendMessageSchema } from "@/lib/justos/crm/validators";
import { getWhatsappSession } from "@/lib/justos/whatsapp/session-service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { workspaceId } = await getCrmApiContext();
    const { id } = await params;
    const messages = await getCrmConversationMessages({
      workspaceId,
      conversationId: id,
    });
    return NextResponse.json({ messages });
  } catch (e) {
    return handleCrmRouteError(e);
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const { workspaceId } = await getCrmApiContext();
    const { id } = await params;
    const body = AppendMessageSchema.parse(await req.json());
    const conv = await getCrmConversation({ workspaceId, conversationId: id });
    const direction = body.direction ?? CrmMessageDirection.OUTBOUND;

    if (direction === CrmMessageDirection.OUTBOUND && isJustosCrmWaSendEnabled()) {
      const phone = conv.contact.phoneE164;
      if (!phone) {
        return NextResponse.json({ error: "Contato sem telefone" }, { status: 400 });
      }
      const session = await getWhatsappSession(workspaceId);
      if (!session || session.status !== "connected") {
        return NextResponse.json(
          { error: "WhatsApp do escritório não conectado", code: "wa_not_connected" },
          { status: 409 },
        );
      }

      const traceId = body.traceId ?? crypto.randomUUID();
      const send = await sendViaJustosCommand({
        workspaceId,
        sessionKey: session.sessionKey,
        to: phone,
        message: body.body,
        traceId,
        caseId: conv.caseId ?? undefined,
      });

      const message = await appendCrmMessage({
        workspaceId,
        conversationId: id,
        input: {
          body: body.body,
          direction,
          traceId,
          deliveryStatus: send.ok ? "sent" : "failed",
          metaJson: { command: true, sendError: send.error },
        },
      });

      return NextResponse.json({ message, send }, { status: 201 });
    }

    const message = await appendCrmMessage({
      workspaceId,
      conversationId: id,
      input: {
        body: body.body,
        direction,
        traceId: body.traceId,
        deliveryStatus: isJustosCrmWaSendEnabled() ? "failed" : "draft_local",
        metaJson: {
          manual: true,
          hint: isJustosCrmWaSendEnabled()
            ? undefined
            : "Ative JUSTOS_CRM_ENABLE_WA_SEND e conecte o WhatsApp para envio real.",
        },
      },
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Payload inválido", detail: e.flatten() }, { status: 400 });
    }
    return handleCrmRouteError(e);
  }
}
