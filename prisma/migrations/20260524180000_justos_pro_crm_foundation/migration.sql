-- JustOS Pro CRM foundation

CREATE TYPE "CrmContactKind" AS ENUM ('CLIENT', 'LEAD', 'COUNTERPARTY', 'WITNESS', 'OTHER');
CREATE TYPE "CrmPipelineStage" AS ENUM ('NEW', 'QUALIFIED', 'ACTIVE', 'WAITING_CLIENT', 'PROPOSAL', 'WON', 'LOST', 'ARCHIVED');
CREATE TYPE "CrmChannel" AS ENUM ('WHATSAPP', 'EMAIL', 'PHONE', 'IN_PERSON', 'SYSTEM');
CREATE TYPE "CrmMessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

CREATE TABLE "CrmContact" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "kind" "CrmContactKind" NOT NULL DEFAULT 'CLIENT',
    "displayName" TEXT NOT NULL,
    "phoneE164" TEXT,
    "email" TEXT,
    "documentId" TEXT,
    "pipelineStage" "CrmPipelineStage" NOT NULL DEFAULT 'NEW',
    "clientId" TEXT,
    "caseId" TEXT,
    "optOutWhatsapp" BOOLEAN NOT NULL DEFAULT false,
    "metadataJson" JSONB,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmContact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmConversation" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "caseId" TEXT,
    "channel" "CrmChannel" NOT NULL DEFAULT 'WHATSAPP',
    "externalChatId" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CrmMessage" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "direction" "CrmMessageDirection" NOT NULL,
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "traceId" TEXT,
    "deliveryStatus" TEXT,
    "metaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrmMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JustosWhatsappSession" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "sessionKey" TEXT NOT NULL,
    "openclawPort" INTEGER,
    "status" TEXT NOT NULL,
    "connectedAt" TIMESTAMP(3),
    "phoneE164" TEXT,
    "lastHealthAt" TIMESTAMP(3),
    "metaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JustosWhatsappSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CrmContact_workspaceId_phoneE164_key" ON "CrmContact"("workspaceId", "phoneE164");
CREATE INDEX "CrmContact_workspaceId_pipelineStage_idx" ON "CrmContact"("workspaceId", "pipelineStage");
CREATE INDEX "CrmContact_workspaceId_email_idx" ON "CrmContact"("workspaceId", "email");
CREATE INDEX "CrmContact_workspaceId_caseId_idx" ON "CrmContact"("workspaceId", "caseId");
CREATE INDEX "CrmContact_workspaceId_deletedAt_idx" ON "CrmContact"("workspaceId", "deletedAt");

CREATE INDEX "CrmConversation_workspaceId_lastMessageAt_idx" ON "CrmConversation"("workspaceId", "lastMessageAt");
CREATE INDEX "CrmConversation_workspaceId_contactId_idx" ON "CrmConversation"("workspaceId", "contactId");
CREATE INDEX "CrmConversation_workspaceId_caseId_idx" ON "CrmConversation"("workspaceId", "caseId");

CREATE INDEX "CrmMessage_workspaceId_sentAt_idx" ON "CrmMessage"("workspaceId", "sentAt");
CREATE INDEX "CrmMessage_conversationId_sentAt_idx" ON "CrmMessage"("conversationId", "sentAt");

CREATE UNIQUE INDEX "JustosWhatsappSession_workspaceId_key" ON "JustosWhatsappSession"("workspaceId");
CREATE INDEX "JustosWhatsappSession_sessionKey_idx" ON "JustosWhatsappSession"("sessionKey");
CREATE INDEX "JustosWhatsappSession_status_idx" ON "JustosWhatsappSession"("status");

ALTER TABLE "CrmContact" ADD CONSTRAINT "CrmContact_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmContact" ADD CONSTRAINT "CrmContact_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CrmContact" ADD CONSTRAINT "CrmContact_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CrmConversation" ADD CONSTRAINT "CrmConversation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmConversation" ADD CONSTRAINT "CrmConversation_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CrmMessage" ADD CONSTRAINT "CrmMessage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmMessage" ADD CONSTRAINT "CrmMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "CrmConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JustosWhatsappSession" ADD CONSTRAINT "JustosWhatsappSession_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
