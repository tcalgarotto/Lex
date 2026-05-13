-- Remove InterviewTemplate (roteiros criados pelo workspace; checklists ficam só no código em /cases/new + registry estático).

ALTER TABLE "InterviewTemplate" DROP CONSTRAINT IF EXISTS "InterviewTemplate_workspaceId_fkey";
ALTER TABLE "InterviewTemplate" DROP CONSTRAINT IF EXISTS "InterviewTemplate_ownerUserId_fkey";

DROP TABLE IF EXISTS "InterviewTemplate";

DROP TYPE IF EXISTS "InterviewTemplateScope";
