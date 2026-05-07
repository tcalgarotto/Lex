-- CreateEnum
CREATE TYPE "CaseCommentVisibility" AS ENUM ('WORKSPACE', 'PRIVATE');

-- CreateEnum
CREATE TYPE "CaseAnnotationKind" AS ENUM ('HIGHLIGHT', 'WEAKNESS', 'STRENGTH', 'TODO', 'CITATION');

-- CreateEnum
CREATE TYPE "DraftApprovalStatus" AS ENUM ('REQUESTED', 'APPROVED', 'CHANGES_REQUESTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CaseAlertKind" AS ENUM ('JURISPRUDENCE_DRIFT', 'THESIS_WEAKENED', 'CONTEXTUAL_RISK', 'RISING_RISK', 'RELEVANT_MOVEMENT', 'STRATEGIC_HISTORY', 'NORM_REVOKED', 'PRECEDENT_DIVERGENCE', 'DEADLINE');

-- CreateEnum
CREATE TYPE "CaseAlertSeverity" AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "CaseAlertStatus" AS ENUM ('OPEN', 'ACKED', 'DISMISSED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('PJE', 'ESAJ', 'PROJUDI', 'EPROC', 'DIARIO_OFICIAL', 'EMAIL', 'WHATSAPP', 'CALENDAR', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('DISCONNECTED', 'CONNECTED', 'ERROR', 'PAUSED');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('ALERT', 'COMMENT', 'APPROVAL', 'INTEGRATION', 'SYSTEM');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('UNREAD', 'READ', 'ARCHIVED');

-- (FTS index `LegalChunk_textTsv_gin` é preservado deliberadamente — não recriar/dropar.)

-- CreateTable
CREATE TABLE "CaseComment" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "draftId" TEXT,
    "body" TEXT NOT NULL,
    "visibility" "CaseCommentVisibility" NOT NULL DEFAULT 'WORKSPACE',
    "refChunkIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseAnnotation" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "draftId" TEXT,
    "authorId" TEXT NOT NULL,
    "kind" "CaseAnnotationKind" NOT NULL DEFAULT 'HIGHLIGHT',
    "startOffset" INTEGER NOT NULL,
    "endOffset" INTEGER NOT NULL,
    "excerpt" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseAnnotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DraftApproval" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "reviewerId" TEXT,
    "status" "DraftApprovalStatus" NOT NULL DEFAULT 'REQUESTED',
    "rationale" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DraftApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseAlert" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "caseId" TEXT,
    "kind" "CaseAlertKind" NOT NULL,
    "severity" "CaseAlertSeverity" NOT NULL DEFAULT 'INFO',
    "status" "CaseAlertStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "reference" TEXT,
    "fingerprint" TEXT NOT NULL,
    "payloadJson" JSONB,
    "ackedAt" TIMESTAMP(3),
    "ackedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "label" TEXT NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "configJson" JSONB,
    "secretRef" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT,
    "kind" "NotificationKind" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'UNREAD',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "refIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "payloadJson" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CaseComment_caseId_createdAt_idx" ON "CaseComment"("caseId", "createdAt");

-- CreateIndex
CREATE INDEX "CaseComment_authorId_createdAt_idx" ON "CaseComment"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "CaseComment_draftId_idx" ON "CaseComment"("draftId");

-- CreateIndex
CREATE INDEX "CaseAnnotation_caseId_draftId_idx" ON "CaseAnnotation"("caseId", "draftId");

-- CreateIndex
CREATE INDEX "CaseAnnotation_authorId_createdAt_idx" ON "CaseAnnotation"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "DraftApproval_caseId_status_idx" ON "DraftApproval"("caseId", "status");

-- CreateIndex
CREATE INDEX "DraftApproval_draftId_status_idx" ON "DraftApproval"("draftId", "status");

-- CreateIndex
CREATE INDEX "CaseAlert_workspaceId_status_severity_idx" ON "CaseAlert"("workspaceId", "status", "severity");

-- CreateIndex
CREATE INDEX "CaseAlert_caseId_status_idx" ON "CaseAlert"("caseId", "status");

-- CreateIndex
CREATE INDEX "CaseAlert_workspaceId_kind_createdAt_idx" ON "CaseAlert"("workspaceId", "kind", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CaseAlert_workspaceId_fingerprint_key" ON "CaseAlert"("workspaceId", "fingerprint");

-- CreateIndex
CREATE INDEX "Integration_workspaceId_provider_status_idx" ON "Integration"("workspaceId", "provider", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Integration_workspaceId_provider_label_key" ON "Integration"("workspaceId", "provider", "label");

-- CreateIndex
CREATE INDEX "Notification_workspaceId_userId_status_idx" ON "Notification"("workspaceId", "userId", "status");

-- CreateIndex
CREATE INDEX "Notification_workspaceId_kind_createdAt_idx" ON "Notification"("workspaceId", "kind", "createdAt");

-- AddForeignKey
ALTER TABLE "CaseComment" ADD CONSTRAINT "CaseComment_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseAnnotation" ADD CONSTRAINT "CaseAnnotation_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftApproval" ADD CONSTRAINT "DraftApproval_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftApproval" ADD CONSTRAINT "DraftApproval_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "CaseDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseAlert" ADD CONSTRAINT "CaseAlert_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseAlert" ADD CONSTRAINT "CaseAlert_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
