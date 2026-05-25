-- CrmActivity timeline + assignees

CREATE TYPE "CrmActivityType" AS ENUM (
  'NOTE',
  'CALL',
  'WHATSAPP_INBOUND',
  'WHATSAPP_OUTBOUND',
  'STAGE_CHANGE',
  'TASK',
  'FOLLOW_UP',
  'SYSTEM'
);

ALTER TABLE "CrmContact" ADD COLUMN IF NOT EXISTS "assignedToUserId" TEXT;
ALTER TABLE "CrmConversation" ADD COLUMN IF NOT EXISTS "assignedToUserId" TEXT;

CREATE TABLE "CrmActivity" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "caseId" TEXT,
    "conversationId" TEXT,
    "messageId" TEXT,
    "type" "CrmActivityType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "dueAt" TIMESTAMP(3),
    "doneAt" TIMESTAMP(3),
    "assignedToUserId" TEXT,
    "metadataJson" JSONB,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CrmActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CrmActivity_workspaceId_contactId_createdAt_idx" ON "CrmActivity"("workspaceId", "contactId", "createdAt");
CREATE INDEX "CrmActivity_workspaceId_caseId_createdAt_idx" ON "CrmActivity"("workspaceId", "caseId", "createdAt");
CREATE INDEX "CrmActivity_workspaceId_type_dueAt_idx" ON "CrmActivity"("workspaceId", "type", "dueAt");
CREATE INDEX "CrmActivity_workspaceId_assignedToUserId_doneAt_idx" ON "CrmActivity"("workspaceId", "assignedToUserId", "doneAt");

ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrmActivity" ADD CONSTRAINT "CrmActivity_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "CrmConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CrmActivity" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_activity_workspace" ON "CrmActivity"
  FOR ALL
  USING ("workspaceId" = current_setting('app.workspace_id', true))
  WITH CHECK ("workspaceId" = current_setting('app.workspace_id', true));
