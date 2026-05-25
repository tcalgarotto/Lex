/**
 * Isolamento CRM — 2 workspaces (DB real).
 * npm run justos:crm:test-two-workspaces
 */

import { PrismaClient, CrmMessageDirection } from "@prisma/client";
import { appendCrmMessage, getOrCreateConversation } from "../src/lib/justos/crm/conversation-service";
import { buildSessionKey, ensureWhatsappSession } from "../src/lib/justos/whatsapp/session-service";
import { processInboundWhatsapp } from "../src/lib/justos/whatsapp/inbound-service";

const prisma = new PrismaClient();

async function main() {
  const workspaces = await prisma.workspace.findMany({ take: 2, orderBy: { createdAt: "asc" } });
  if (workspaces.length < 2) {
    console.error("FAIL: precisa de pelo menos 2 workspaces no banco");
    process.exit(1);
  }

  const a = workspaces[0]!;
  const b = workspaces[1]!;
  const phone = "+5511999990001";

  const contactA = await prisma.crmContact.upsert({
    where: { workspaceId_phoneE164: { workspaceId: a.id, phoneE164: phone } },
    create: {
      workspaceId: a.id,
      displayName: "Teste A",
      phoneE164: phone,
      kind: "LEAD",
    },
    update: {},
  });

  const contactB = await prisma.crmContact.upsert({
    where: { workspaceId_phoneE164: { workspaceId: b.id, phoneE164: phone } },
    create: {
      workspaceId: b.id,
      displayName: "Teste B",
      phoneE164: phone,
      kind: "LEAD",
    },
    update: {},
  });

  const convA = await getOrCreateConversation({
    workspaceId: a.id,
    contactId: contactA.id,
  });

  await appendCrmMessage({
    workspaceId: a.id,
    conversationId: convA.id,
    input: {
      direction: CrmMessageDirection.OUTBOUND,
      body: `isolamento-${Date.now()}`,
      deliveryStatus: "test",
    },
  });

  const leak = await prisma.crmMessage.findFirst({
    where: { workspaceId: b.id, body: { contains: "isolamento-" } },
  });
  if (leak) {
    console.error("FAIL: mensagem de A visível em B");
    process.exit(1);
  }

  const sessionA = await ensureWhatsappSession(a.id);
  const sessionB = await ensureWhatsappSession(b.id);
  if (sessionA.sessionKey === sessionB.sessionKey) {
    console.error("FAIL: sessionKey colidiu entre workspaces");
    process.exit(1);
  }

  expectSessionKey(a.id, sessionA.sessionKey);
  expectSessionKey(b.id, sessionB.sessionKey);

  const inbound = await processInboundWhatsapp({
    workspaceId: a.id,
    sessionKey: sessionA.sessionKey,
    from: phone,
    body: `inbound-${Date.now()}`,
    traceId: `test_${Date.now()}`,
  });

  const wrong = await prisma.crmMessage.findUnique({
    where: { id: inbound.messageId },
  });
  if (wrong?.workspaceId !== a.id) {
    console.error("FAIL: inbound gravou workspace errado");
    process.exit(1);
  }

  console.log("PASS: isolamento 2 workspaces OK", {
    workspaceA: a.id,
    workspaceB: b.id,
    contactA: contactA.id,
    contactB: contactB.id,
  });
}

function expectSessionKey(workspaceId: string, sessionKey: string) {
  const expected = buildSessionKey(workspaceId);
  if (sessionKey !== expected) {
    throw new Error(`sessionKey diverge para ${workspaceId}`);
  }
}

main()
  .catch((e) => {
    console.error("FAIL:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
