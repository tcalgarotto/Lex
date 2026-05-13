-- CreateEnum
CREATE TYPE "LegalProcessDataJudStatus" AS ENUM ('ACTIVE', 'NOT_FOUND', 'UNAVAILABLE', 'ERROR', 'DISABLED');

-- CreateEnum
CREATE TYPE "LegalProcessSyncStatus" AS ENUM ('SUCCESS', 'NOT_FOUND', 'ERROR', 'SKIPPED');

-- CreateEnum
CREATE TYPE "LegalProcessSyncSource" AS ENUM ('MANUAL', 'DAILY', 'AUTOCOMPLETE', 'IMPORT');

-- CreateEnum
CREATE TYPE "LegalProcessAlertType" AS ENUM ('NEW_MOVEMENT', 'ATTENTION', 'STALE_PROCESS', 'SYNC_FAILED', 'DATAJUD_UNAVAILABLE');

-- CreateEnum
CREATE TYPE "LegalProcessAlertSeverity" AS ENUM ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "LegalProcessAlertStatus" AS ENUM ('OPEN', 'ACKED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "CourtConnectorType" AS ENUM ('DATAJUD_PUBLIC', 'ESCRITORIO_DIGITAL', 'MNI', 'PJE', 'ESAJ', 'EPROC', 'PROJUDI', 'MANUAL_UPLOAD');

-- CreateEnum
CREATE TYPE "CourtConnectorStatus" AS ENUM ('active', 'pending_credentials', 'requires_official_authorization', 'unavailable', 'planned', 'disabled');

-- CreateEnum
CREATE TYPE "CourtConnectionAuthType" AS ENUM ('NONE', 'OFFICIAL_OAUTH', 'OFFICIAL_TOKEN', 'CERTIFICATE_TOKEN', 'MANUAL');

-- CreateTable
CREATE TABLE "LegalProcess" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "caseId" TEXT,
    "processId" TEXT,
    "cnj" TEXT NOT NULL,
    "cnjFormatted" TEXT NOT NULL,
    "tribunalAcronym" TEXT NOT NULL,
    "tribunalAlias" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "grau" TEXT,
    "classeCodigo" TEXT,
    "classeNome" TEXT,
    "assuntosJson" JSONB,
    "dataAjuizamento" TIMESTAMP(3),
    "orgaoJulgadorCodigo" TEXT,
    "orgaoJulgadorNome" TEXT,
    "sistemaCodigo" TEXT,
    "sistemaNome" TEXT,
    "formatoCodigo" TEXT,
    "formatoNome" TEXT,
    "nivelSigilo" INTEGER,
    "dataHoraUltimaAtualizacao" TIMESTAMP(3),
    "lastDataJudSyncAt" TIMESTAMP(3),
    "dataJudStatus" "LegalProcessDataJudStatus" NOT NULL DEFAULT 'ACTIVE',
    "dataJudRawJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalProcess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalProcessMovement" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "legalProcessId" TEXT NOT NULL,
    "codigo" TEXT,
    "nome" TEXT NOT NULL,
    "dataHora" TIMESTAMP(3),
    "category" TEXT NOT NULL DEFAULT 'outros',
    "complementosJson" JSONB,
    "orgaoJulgadorJson" JSONB,
    "movementHash" TEXT NOT NULL,
    "rawJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalProcessMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalProcessSyncLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "legalProcessId" TEXT,
    "cnj" TEXT NOT NULL,
    "tribunalAlias" TEXT NOT NULL,
    "status" "LegalProcessSyncStatus" NOT NULL,
    "source" "LegalProcessSyncSource" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "resultCount" INTEGER NOT NULL DEFAULT 0,
    "rawMetaJson" JSONB,

    CONSTRAINT "LegalProcessSyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalProcessAlert" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "legalProcessId" TEXT NOT NULL,
    "type" "LegalProcessAlertType" NOT NULL,
    "severity" "LegalProcessAlertSeverity" NOT NULL DEFAULT 'INFO',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "LegalProcessAlertStatus" NOT NULL DEFAULT 'OPEN',
    "fingerprint" TEXT NOT NULL,
    "payloadJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "LegalProcessAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourtConnection" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" "CourtConnectorType" NOT NULL,
    "status" "CourtConnectorStatus" NOT NULL,
    "authType" "CourtConnectionAuthType" NOT NULL DEFAULT 'NONE',
    "encryptedToken" TEXT,
    "scopesJson" JSONB,
    "lastConnectedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourtConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourtConnectionAuditLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "connectionId" TEXT,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadataJson" JSONB,

    CONSTRAINT "CourtConnectionAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LegalProcess_workspaceId_cnj_key" ON "LegalProcess"("workspaceId", "cnj");

-- CreateIndex
CREATE INDEX "LegalProcess_workspaceId_caseId_idx" ON "LegalProcess"("workspaceId", "caseId");

-- CreateIndex
CREATE INDEX "LegalProcess_processId_idx" ON "LegalProcess"("processId");

-- CreateIndex
CREATE INDEX "LegalProcess_workspaceId_dataJudStatus_idx" ON "LegalProcess"("workspaceId", "dataJudStatus");

-- CreateIndex
CREATE INDEX "LegalProcess_workspaceId_lastDataJudSyncAt_idx" ON "LegalProcess"("workspaceId", "lastDataJudSyncAt");

-- CreateIndex
CREATE INDEX "LegalProcess_tribunalAcronym_idx" ON "LegalProcess"("tribunalAcronym");

-- CreateIndex
CREATE INDEX "LegalProcess_tribunalAlias_idx" ON "LegalProcess"("tribunalAlias");

-- CreateIndex
CREATE UNIQUE INDEX "LegalProcessMovement_legalProcessId_movementHash_key" ON "LegalProcessMovement"("legalProcessId", "movementHash");

-- CreateIndex
CREATE INDEX "LegalProcessMovement_workspaceId_idx" ON "LegalProcessMovement"("workspaceId");

-- CreateIndex
CREATE INDEX "LegalProcessMovement_legalProcessId_dataHora_idx" ON "LegalProcessMovement"("legalProcessId", "dataHora");

-- CreateIndex
CREATE INDEX "LegalProcessMovement_legalProcessId_category_idx" ON "LegalProcessMovement"("legalProcessId", "category");

-- CreateIndex
CREATE INDEX "LegalProcessSyncLog_workspaceId_idx" ON "LegalProcessSyncLog"("workspaceId");

-- CreateIndex
CREATE INDEX "LegalProcessSyncLog_workspaceId_status_startedAt_idx" ON "LegalProcessSyncLog"("workspaceId", "status", "startedAt");

-- CreateIndex
CREATE INDEX "LegalProcessSyncLog_legalProcessId_startedAt_idx" ON "LegalProcessSyncLog"("legalProcessId", "startedAt");

-- CreateIndex
CREATE INDEX "LegalProcessSyncLog_workspaceId_cnj_idx" ON "LegalProcessSyncLog"("workspaceId", "cnj");

-- CreateIndex
CREATE UNIQUE INDEX "LegalProcessAlert_workspaceId_fingerprint_key" ON "LegalProcessAlert"("workspaceId", "fingerprint");

-- CreateIndex
CREATE INDEX "LegalProcessAlert_workspaceId_status_severity_idx" ON "LegalProcessAlert"("workspaceId", "status", "severity");

-- CreateIndex
CREATE INDEX "LegalProcessAlert_legalProcessId_status_idx" ON "LegalProcessAlert"("legalProcessId", "status");

-- CreateIndex
CREATE INDEX "LegalProcessAlert_workspaceId_type_createdAt_idx" ON "LegalProcessAlert"("workspaceId", "type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CourtConnection_workspaceId_provider_key" ON "CourtConnection"("workspaceId", "provider");

-- CreateIndex
CREATE INDEX "CourtConnection_workspaceId_status_idx" ON "CourtConnection"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "CourtConnection_workspaceId_provider_status_idx" ON "CourtConnection"("workspaceId", "provider", "status");

-- CreateIndex
CREATE INDEX "CourtConnectionAuditLog_workspaceId_createdAt_idx" ON "CourtConnectionAuditLog"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "CourtConnectionAuditLog_connectionId_createdAt_idx" ON "CourtConnectionAuditLog"("connectionId", "createdAt");

-- AddForeignKey
ALTER TABLE "LegalProcess" ADD CONSTRAINT "LegalProcess_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalProcess" ADD CONSTRAINT "LegalProcess_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalProcess" ADD CONSTRAINT "LegalProcess_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalProcessMovement" ADD CONSTRAINT "LegalProcessMovement_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalProcessMovement" ADD CONSTRAINT "LegalProcessMovement_legalProcessId_fkey" FOREIGN KEY ("legalProcessId") REFERENCES "LegalProcess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalProcessSyncLog" ADD CONSTRAINT "LegalProcessSyncLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalProcessSyncLog" ADD CONSTRAINT "LegalProcessSyncLog_legalProcessId_fkey" FOREIGN KEY ("legalProcessId") REFERENCES "LegalProcess"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalProcessAlert" ADD CONSTRAINT "LegalProcessAlert_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalProcessAlert" ADD CONSTRAINT "LegalProcessAlert_legalProcessId_fkey" FOREIGN KEY ("legalProcessId") REFERENCES "LegalProcess"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourtConnection" ADD CONSTRAINT "CourtConnection_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourtConnectionAuditLog" ADD CONSTRAINT "CourtConnectionAuditLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourtConnectionAuditLog" ADD CONSTRAINT "CourtConnectionAuditLog_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "CourtConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
