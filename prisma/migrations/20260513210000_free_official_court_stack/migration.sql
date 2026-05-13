-- Expand official court connector catalog.
ALTER TYPE "CourtConnectorType" ADD VALUE IF NOT EXISTS 'DOMICILIO_JUDICIAL';
ALTER TYPE "CourtConnectorType" ADD VALUE IF NOT EXISTS 'DJEN';
ALTER TYPE "CourtConnectorType" ADD VALUE IF NOT EXISTS 'OFFICIAL_GAZETTE';
ALTER TYPE "CourtConnectorType" ADD VALUE IF NOT EXISTS 'TRIBUNAL_PUBLIC_QUERY';
ALTER TYPE "CourtConnectorType" ADD VALUE IF NOT EXISTS 'MANUAL_PASTE';

ALTER TYPE "CourtConnectorStatus" ADD VALUE IF NOT EXISTS 'available';
ALTER TYPE "CourtConnectorStatus" ADD VALUE IF NOT EXISTS 'requires_user_login';
ALTER TYPE "CourtConnectorStatus" ADD VALUE IF NOT EXISTS 'requires_certificate';
ALTER TYPE "CourtConnectorStatus" ADD VALUE IF NOT EXISTS 'public_read_only';
ALTER TYPE "CourtConnectorStatus" ADD VALUE IF NOT EXISTS 'manual_bridge';
ALTER TYPE "CourtConnectorStatus" ADD VALUE IF NOT EXISTS 'blocked';

-- Manual/assisted official communications imported from official sources.
CREATE TYPE "OfficialCommunicationSource" AS ENUM (
  'DOMICILIO_JUDICIAL',
  'DJEN',
  'ESCRITORIO_DIGITAL',
  'OFFICIAL_GAZETTE',
  'TRIBUNAL_PUBLIC_QUERY',
  'MANUAL',
  'OTHER_OFFICIAL'
);

CREATE TYPE "OfficialCommunicationType" AS ENUM (
  'CITACAO',
  'INTIMACAO',
  'OFICIO',
  'AUDIENCIA',
  'PUBLICACAO',
  'OUTRO'
);

CREATE TYPE "OfficialCommunicationStatus" AS ENUM (
  'NEEDS_REVIEW',
  'REVIEWED',
  'DISCARDED'
);

CREATE TABLE "OfficialCommunication" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "legalProcessId" TEXT,
  "processId" TEXT,
  "caseId" TEXT,
  "documentId" TEXT,
  "source" "OfficialCommunicationSource" NOT NULL,
  "communicationType" "OfficialCommunicationType" NOT NULL DEFAULT 'OUTRO',
  "receivedAt" TIMESTAMP(3),
  "availableAt" TIMESTAMP(3),
  "readAt" TIMESTAMP(3),
  "dueReviewAt" TIMESTAMP(3),
  "status" "OfficialCommunicationStatus" NOT NULL DEFAULT 'NEEDS_REVIEW',
  "title" TEXT NOT NULL,
  "description" TEXT,
  "rawText" TEXT,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OfficialCommunication_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "OfficialCommunication"
  ADD CONSTRAINT "OfficialCommunication_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OfficialCommunication"
  ADD CONSTRAINT "OfficialCommunication_legalProcessId_fkey"
  FOREIGN KEY ("legalProcessId") REFERENCES "LegalProcess"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OfficialCommunication"
  ADD CONSTRAINT "OfficialCommunication_processId_fkey"
  FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OfficialCommunication"
  ADD CONSTRAINT "OfficialCommunication_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OfficialCommunication"
  ADD CONSTRAINT "OfficialCommunication_documentId_fkey"
  FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "OfficialCommunication_workspaceId_status_dueReviewAt_idx"
  ON "OfficialCommunication"("workspaceId", "status", "dueReviewAt");

CREATE INDEX "OfficialCommunication_workspaceId_source_createdAt_idx"
  ON "OfficialCommunication"("workspaceId", "source", "createdAt");

CREATE INDEX "OfficialCommunication_legalProcessId_idx"
  ON "OfficialCommunication"("legalProcessId");

CREATE INDEX "OfficialCommunication_processId_idx"
  ON "OfficialCommunication"("processId");

CREATE INDEX "OfficialCommunication_caseId_idx"
  ON "OfficialCommunication"("caseId");

CREATE INDEX "OfficialCommunication_documentId_idx"
  ON "OfficialCommunication"("documentId");
