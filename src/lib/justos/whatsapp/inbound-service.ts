import { CrmContactKind, CrmMessageDirection } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { runCrmAutomations } from "@/lib/justos/crm/automation-engine";
import { appendCrmMessage, getOrCreateConversation } from "@/lib/justos/crm/conversation-service";
import { normalizeCrmPhoneE164 } from "@/lib/justos/crm/phone";
import { emitJustosEvent } from "@/lib/justos/emit-justos-event";
import { assertSessionBelongsToWorkspace } from "./session-service";

export type InboundWhatsappPayload = {
  workspaceId: string;
  sessionKey: string;
  from: string;
  body: string;
  messageId?: string;
  timestamp?: string;
  traceId?: string;
};

export async function processInboundWhatsapp(
  payload: InboundWhatsappPayload,
): Promise<{ contactId: string; conversationId: string; messageId: string }> {
  await assertSessionBelongsToWorkspace(payload.workspaceId, payload.sessionKey);

  const phoneE164 = normalizeCrmPhoneE164(payload.from);
  if (!phoneE164) throw new Error("Telefone inválido");

  let contact = await prisma.crmContact.findFirst({
    where: { workspaceId: payload.workspaceId, phoneE164, deletedAt: null },
  });
  const isNewContact = !contact;

  if (!contact) {
    contact = await prisma.crmContact.create({
      data: {
        workspaceId: payload.workspaceId,
        kind: CrmContactKind.LEAD,
        displayName: phoneE164,
        phoneE164,
      },
    });
  }

  const conversation = await getOrCreateConversation({
    workspaceId: payload.workspaceId,
    contactId: contact.id,
    channel: "WHATSAPP",
  });

  void runCrmAutomations({
    workspaceId: payload.workspaceId,
    contactId: contact.id,
    trigger: "conversation.inbound.created",
    conversationId: conversation.id,
    caseId: conversation.caseId,
    isNewContact,
    stage: contact.pipelineStage,
  }).catch(() => {});

  const msg = await appendCrmMessage({
    workspaceId: payload.workspaceId,
    conversationId: conversation.id,
    input: {
      direction: CrmMessageDirection.INBOUND,
      body: payload.body,
      sentAt: payload.timestamp ? new Date(payload.timestamp) : new Date(),
      traceId: payload.traceId,
      deliveryStatus: "received",
      metaJson: {
        externalMessageId: payload.messageId,
        sessionKey: payload.sessionKey,
      },
    },
  });

  void emitJustosEvent({
    event: "justos.crm.message.inbound",
    workspaceId: payload.workspaceId,
    meta: {
      contactId: contact.id,
      conversationId: conversation.id,
      messageId: msg.id,
    },
    extras: { phoneE164 },
    traceId: payload.traceId,
  }).catch(() => {});

  return {
    contactId: contact.id,
    conversationId: conversation.id,
    messageId: msg.id,
  };
}
