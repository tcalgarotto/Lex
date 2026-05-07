-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('INTAKE', 'RESEARCH', 'DRAFTING', 'REVIEW', 'READY', 'FILED', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CasePartyRole" AS ENUM ('AUTHOR', 'DEFENDANT', 'INTERVENING', 'OTHER');

-- CreateEnum
CREATE TYPE "CasePartyKind" AS ENUM ('PERSON', 'COMPANY', 'PUBLIC_ENTITY', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CaseRequestKind" AS ENUM ('MAIN', 'SUBSIDIARY', 'URGENCY', 'PROVISIONAL', 'EVIDENCE', 'PROCEDURAL', 'OTHER');

-- CreateEnum
CREATE TYPE "CaseRiskSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "CaseRiskKind" AS ENUM ('REVOKED_NORM', 'PRECEDENT_DIVERGENCE', 'HISTORIC_VERSION', 'MISSING_GROUNDING', 'WEAK_ARGUMENT', 'PROCEDURAL_GAP', 'OTHER');

-- CreateEnum
CREATE TYPE "CaseDraftStatus" AS ENUM ('PENDING', 'GENERATED', 'EDITED', 'APPROVED');

-- CreateEnum
CREATE TYPE "CaseTimelineKind" AS ENUM ('CASE_CREATED', 'INTAKE_COMPLETED', 'RESEARCH_RUN', 'DRAFT_GENERATED', 'DRAFT_EDITED', 'REVIEW_RUN', 'RISK_FLAGGED', 'STATUS_CHANGED', 'NOTE');

-- CreateTable
CREATE TABLE "Case" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "rawInput" TEXT NOT NULL,
    "status" "CaseStatus" NOT NULL DEFAULT 'INTAKE',
    "tribunalCode" TEXT,
    "uf" TEXT,
    "processNumber" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseFact" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "category" TEXT,
    "dates" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.6,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseParty" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "role" "CasePartyRole" NOT NULL,
    "kind" "CasePartyKind" NOT NULL DEFAULT 'UNKNOWN',
    "name" TEXT NOT NULL,
    "document" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseParty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseRequest" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "kind" "CaseRequestKind" NOT NULL DEFAULT 'MAIN',
    "text" TEXT NOT NULL,
    "legalBasisUrn" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseRisk" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "kind" "CaseRiskKind" NOT NULL,
    "severity" "CaseRiskSeverity" NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "evidenceChunkIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "evidenceNormUrns" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseRisk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseDraft" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "CaseDraftStatus" NOT NULL DEFAULT 'PENDING',
    "content" TEXT NOT NULL,
    "groundingChunkIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseReview" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "verdict" TEXT NOT NULL,
    "checklistJson" JSONB NOT NULL,
    "riskIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseTimelineEvent" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "kind" "CaseTimelineKind" NOT NULL,
    "message" TEXT NOT NULL,
    "payloadJson" JSONB,
    "retrievalChunkIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "traceId" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseTimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Case_workspaceId_status_idx" ON "Case"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "Case_workspaceId_updatedAt_idx" ON "Case"("workspaceId", "updatedAt");

-- CreateIndex
CREATE INDEX "Case_tribunalCode_idx" ON "Case"("tribunalCode");

-- CreateIndex
CREATE INDEX "CaseFact_caseId_idx" ON "CaseFact"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "CaseFact_caseId_ordinal_key" ON "CaseFact"("caseId", "ordinal");

-- CreateIndex
CREATE INDEX "CaseParty_caseId_idx" ON "CaseParty"("caseId");

-- CreateIndex
CREATE INDEX "CaseRequest_caseId_idx" ON "CaseRequest"("caseId");

-- CreateIndex
CREATE UNIQUE INDEX "CaseRequest_caseId_ordinal_key" ON "CaseRequest"("caseId", "ordinal");

-- CreateIndex
CREATE INDEX "CaseRisk_caseId_severity_idx" ON "CaseRisk"("caseId", "severity");

-- CreateIndex
CREATE INDEX "CaseDraft_caseId_version_idx" ON "CaseDraft"("caseId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "CaseDraft_caseId_version_key" ON "CaseDraft"("caseId", "version");

-- CreateIndex
CREATE INDEX "CaseReview_caseId_createdAt_idx" ON "CaseReview"("caseId", "createdAt");

-- CreateIndex
CREATE INDEX "CaseTimelineEvent_caseId_createdAt_idx" ON "CaseTimelineEvent"("caseId", "createdAt");

-- AddForeignKey
ALTER TABLE "Case" ADD CONSTRAINT "Case_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseFact" ADD CONSTRAINT "CaseFact_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseParty" ADD CONSTRAINT "CaseParty_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseRequest" ADD CONSTRAINT "CaseRequest_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseRisk" ADD CONSTRAINT "CaseRisk_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseDraft" ADD CONSTRAINT "CaseDraft_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseReview" ADD CONSTRAINT "CaseReview_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseTimelineEvent" ADD CONSTRAINT "CaseTimelineEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
