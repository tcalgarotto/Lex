-- CreateEnum
CREATE TYPE "NormKind" AS ENUM ('CONSTITUTION', 'CONSTITUTIONAL_AMENDMENT', 'COMPLEMENTARY_LAW', 'ORDINARY_LAW', 'DELEGATED_LAW', 'PROVISIONAL_MEASURE', 'DECREE_LAW', 'DECREE', 'RESOLUTION', 'PORTARIA', 'NORMATIVE_INSTRUCTION', 'CIRCULAR', 'CODE', 'REGIMENT', 'JURISPRUDENCE_STF', 'JURISPRUDENCE_STJ', 'JURISPRUDENCE_TST', 'JURISPRUDENCE_OTHER', 'SUMULA_STF', 'SUMULA_STJ', 'SUMULA_VINCULANTE', 'REPETITIVE_THEME', 'OTHER');

-- CreateEnum
CREATE TYPE "NormJurisdiction" AS ENUM ('FEDERAL', 'STATE', 'MUNICIPAL', 'DISTRITAL', 'INTERNATIONAL', 'AGENCY', 'COURT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "NormStatus" AS ENUM ('ACTIVE', 'REVOKED', 'SUSPENDED', 'SUPERSEDED', 'DRAFT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "CorpusProvider" AS ENUM ('LEXML', 'STF', 'STJ', 'TST', 'PLANALTO', 'DATAJUD', 'MANUAL', 'FIXTURE');

-- CreateEnum
CREATE TYPE "CitationKind" AS ENUM ('CITES', 'REFERENCED_BY', 'REVOKES', 'REVOKED_BY', 'AMENDS', 'AMENDED_BY', 'REGULATES', 'REGULATED_BY', 'OVERRULES', 'OVERRULED_BY', 'RELATES_TO');

-- CreateEnum
CREATE TYPE "LegalStructure" AS ENUM ('EMENTA', 'PREAMBULO', 'PARTE', 'LIVRO', 'TITULO', 'CAPITULO', 'SECAO', 'SUBSECAO', 'ARTIGO', 'CAPUT', 'PARAGRAFO', 'INCISO', 'ALINEA', 'ITEM', 'ANEXO', 'NOTE', 'GENERIC');

-- CreateEnum
CREATE TYPE "IngestionJobStatus" AS ENUM ('PENDING', 'RUNNING', 'PARTIAL', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "LegalNorm" (
    "id" TEXT NOT NULL,
    "urn" TEXT NOT NULL,
    "kind" "NormKind" NOT NULL,
    "jurisdiction" "NormJurisdiction" NOT NULL DEFAULT 'UNKNOWN',
    "status" "NormStatus" NOT NULL DEFAULT 'ACTIVE',
    "title" TEXT NOT NULL,
    "identifier" TEXT,
    "authority" TEXT,
    "tribunal" TEXT,
    "rapporteur" TEXT,
    "ementa" TEXT,
    "publishedAt" TIMESTAMP(3),
    "effectiveAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "language" TEXT NOT NULL DEFAULT 'pt-BR',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sourceProvider" "CorpusProvider" NOT NULL,
    "sourceUrl" TEXT,
    "sourceExternalId" TEXT,
    "lastFetchedAt" TIMESTAMP(3),
    "etag" TEXT,
    "lastModifiedAt" TIMESTAMP(3),
    "contentHash" TEXT,
    "hierarchyJson" JSONB,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalNorm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalNormVersion" (
    "id" TEXT NOT NULL,
    "normId" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "contentHash" TEXT NOT NULL,
    "rawText" TEXT NOT NULL,
    "htmlSource" TEXT,
    "structureJson" JSONB,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalNormVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalChunk" (
    "id" TEXT NOT NULL,
    "normId" TEXT NOT NULL,
    "normVersionId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "structure" "LegalStructure" NOT NULL DEFAULT 'GENERIC',
    "fullPath" TEXT,
    "articleRef" TEXT,
    "paragraphRef" TEXT,
    "incisoRef" TEXT,
    "alineaRef" TEXT,
    "text" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "tokenEstimate" INTEGER,
    "vectorPointId" TEXT,
    "chunkerVersion" TEXT NOT NULL DEFAULT 'v2',
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalCitation" (
    "id" TEXT NOT NULL,
    "sourceNormId" TEXT NOT NULL,
    "targetNormId" TEXT,
    "targetUrn" TEXT NOT NULL,
    "rawText" TEXT,
    "kind" "CitationKind" NOT NULL DEFAULT 'CITES',
    "sourceChunkId" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalCitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionWatermark" (
    "id" TEXT NOT NULL,
    "provider" "CorpusProvider" NOT NULL,
    "kind" "NormKind" NOT NULL,
    "cursor" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "itemsTotal" INTEGER NOT NULL DEFAULT 0,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngestionWatermark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionJob" (
    "id" TEXT NOT NULL,
    "provider" "CorpusProvider" NOT NULL,
    "kind" "NormKind",
    "status" "IngestionJobStatus" NOT NULL DEFAULT 'PENDING',
    "cursor" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "itemsProcessed" INTEGER NOT NULL DEFAULT 0,
    "itemsCreated" INTEGER NOT NULL DEFAULT 0,
    "itemsUpdated" INTEGER NOT NULL DEFAULT 0,
    "itemsSkipped" INTEGER NOT NULL DEFAULT 0,
    "itemsFailed" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "metadataJson" JSONB,

    CONSTRAINT "IngestionJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LegalNorm_urn_key" ON "LegalNorm"("urn");

-- CreateIndex
CREATE INDEX "LegalNorm_kind_idx" ON "LegalNorm"("kind");

-- CreateIndex
CREATE INDEX "LegalNorm_jurisdiction_idx" ON "LegalNorm"("jurisdiction");

-- CreateIndex
CREATE INDEX "LegalNorm_status_idx" ON "LegalNorm"("status");

-- CreateIndex
CREATE INDEX "LegalNorm_sourceProvider_idx" ON "LegalNorm"("sourceProvider");

-- CreateIndex
CREATE INDEX "LegalNorm_publishedAt_idx" ON "LegalNorm"("publishedAt");

-- CreateIndex
CREATE INDEX "LegalNorm_tribunal_idx" ON "LegalNorm"("tribunal");

-- CreateIndex
CREATE INDEX "LegalNormVersion_normId_idx" ON "LegalNormVersion"("normId");

-- CreateIndex
CREATE INDEX "LegalNormVersion_validFrom_idx" ON "LegalNormVersion"("validFrom");

-- CreateIndex
CREATE UNIQUE INDEX "LegalNormVersion_normId_validFrom_key" ON "LegalNormVersion"("normId", "validFrom");

-- CreateIndex
CREATE UNIQUE INDEX "LegalNormVersion_normId_contentHash_key" ON "LegalNormVersion"("normId", "contentHash");

-- CreateIndex
CREATE INDEX "LegalChunk_normId_idx" ON "LegalChunk"("normId");

-- CreateIndex
CREATE INDEX "LegalChunk_structure_idx" ON "LegalChunk"("structure");

-- CreateIndex
CREATE INDEX "LegalChunk_articleRef_idx" ON "LegalChunk"("articleRef");

-- CreateIndex
CREATE INDEX "LegalChunk_contentHash_idx" ON "LegalChunk"("contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "LegalChunk_normVersionId_ordinal_key" ON "LegalChunk"("normVersionId", "ordinal");

-- CreateIndex
CREATE INDEX "LegalCitation_sourceNormId_idx" ON "LegalCitation"("sourceNormId");

-- CreateIndex
CREATE INDEX "LegalCitation_targetNormId_idx" ON "LegalCitation"("targetNormId");

-- CreateIndex
CREATE INDEX "LegalCitation_targetUrn_idx" ON "LegalCitation"("targetUrn");

-- CreateIndex
CREATE INDEX "LegalCitation_kind_idx" ON "LegalCitation"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "IngestionWatermark_provider_kind_key" ON "IngestionWatermark"("provider", "kind");

-- CreateIndex
CREATE INDEX "IngestionJob_provider_status_idx" ON "IngestionJob"("provider", "status");

-- CreateIndex
CREATE INDEX "IngestionJob_startedAt_idx" ON "IngestionJob"("startedAt");

-- AddForeignKey
ALTER TABLE "LegalNormVersion" ADD CONSTRAINT "LegalNormVersion_normId_fkey" FOREIGN KEY ("normId") REFERENCES "LegalNorm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalChunk" ADD CONSTRAINT "LegalChunk_normId_fkey" FOREIGN KEY ("normId") REFERENCES "LegalNorm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalChunk" ADD CONSTRAINT "LegalChunk_normVersionId_fkey" FOREIGN KEY ("normVersionId") REFERENCES "LegalNormVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalCitation" ADD CONSTRAINT "LegalCitation_sourceNormId_fkey" FOREIGN KEY ("sourceNormId") REFERENCES "LegalNorm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalCitation" ADD CONSTRAINT "LegalCitation_targetNormId_fkey" FOREIGN KEY ("targetNormId") REFERENCES "LegalNorm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
