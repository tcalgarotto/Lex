-- F6 — Interview templates (user/workspace scope)

DO $$ BEGIN
  CREATE TYPE "InterviewTemplateScope" AS ENUM ('USER', 'WORKSPACE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "InterviewTemplate" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "scope" "InterviewTemplateScope" NOT NULL DEFAULT 'WORKSPACE',
  "ownerUserId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "domain" TEXT,
  "schemaJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InterviewTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InterviewTemplate_workspaceId_scope_updatedAt_idx"
  ON "InterviewTemplate" ("workspaceId", "scope", "updatedAt");

CREATE INDEX IF NOT EXISTS "InterviewTemplate_workspaceId_domain_idx"
  ON "InterviewTemplate" ("workspaceId", "domain");

CREATE INDEX IF NOT EXISTS "InterviewTemplate_ownerUserId_idx"
  ON "InterviewTemplate" ("ownerUserId");

ALTER TABLE "InterviewTemplate"
  ADD CONSTRAINT "InterviewTemplate_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InterviewTemplate"
  ADD CONSTRAINT "InterviewTemplate_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

