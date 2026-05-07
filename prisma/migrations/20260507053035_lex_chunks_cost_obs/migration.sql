-- CreateEnum
CREATE TYPE "LegalChunkSection" AS ENUM ('preliminaries', 'facts', 'grounds', 'legal_reasoning', 'case_law', 'requests', 'dispositive', 'thesis', 'article_norm', 'generic');

-- CreateEnum
CREATE TYPE "CostCategory" AS ENUM ('EMBEDDING', 'CHAT_COMPLETION', 'COMPLETION', 'RETRIEVAL', 'STORAGE', 'OTHER');

-- AlterTable
ALTER TABLE "DocumentChunk" ADD COLUMN     "contentHash" TEXT,
ADD COLUMN     "section" "LegalChunkSection" NOT NULL DEFAULT 'generic';

-- CreateTable
CREATE TABLE "CostLedgerEntry" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT,
    "category" "CostCategory" NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "costUsd" DOUBLE PRECISION,
    "unitQuantity" INTEGER,
    "metaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ObservabilityLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT,
    "traceId" TEXT,
    "kind" TEXT NOT NULL,
    "name" TEXT,
    "payloadJson" JSONB,
    "retrievalChunkIds" JSONB,
    "latencyMs" INTEGER NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ObservabilityLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CostLedgerEntry_workspaceId_idx" ON "CostLedgerEntry"("workspaceId");

-- CreateIndex
CREATE INDEX "CostLedgerEntry_workspaceId_category_idx" ON "CostLedgerEntry"("workspaceId", "category");

-- CreateIndex
CREATE INDEX "CostLedgerEntry_createdAt_idx" ON "CostLedgerEntry"("createdAt");

-- CreateIndex
CREATE INDEX "ObservabilityLog_workspaceId_kind_idx" ON "ObservabilityLog"("workspaceId", "kind");

-- CreateIndex
CREATE INDEX "ObservabilityLog_createdAt_idx" ON "ObservabilityLog"("createdAt");

-- CreateIndex
CREATE INDEX "DocumentChunk_contentHash_idx" ON "DocumentChunk"("contentHash");

-- AddForeignKey
ALTER TABLE "CostLedgerEntry" ADD CONSTRAINT "CostLedgerEntry_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservabilityLog" ADD CONSTRAINT "ObservabilityLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
