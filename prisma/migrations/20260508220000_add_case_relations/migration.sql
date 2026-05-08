-- Migration: add_case_relations
-- Adiciona pontes leves entre Case <-> Process e Case <-> Document, além
-- de uma tabela `CaseLegalSource` para fundamentos jurídicos pinados em
-- pesquisa do caso.
--
-- Não há perda de dados. Todos os campos novos são NULLABLE.
-- A tabela CaseLegalSource é nova.

-- 1. Document.caseId opcional
ALTER TABLE "Document" ADD COLUMN "caseId" TEXT;

-- 2. Case.processId opcional (1:1 com Process)
ALTER TABLE "Case" ADD COLUMN "processId" TEXT;

-- 3. CaseLegalSource (curadoria de fundamentos)
CREATE TABLE "CaseLegalSource" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "chunkId" TEXT NOT NULL,
    "normUrn" TEXT,
    "articleRef" TEXT,
    "excerpt" TEXT NOT NULL,
    "query" TEXT,
    "pinnedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CaseLegalSource_pkey" PRIMARY KEY ("id")
);

-- 4. Indexes (concurrent não é suportado em transação Prisma; CREATE INDEX
--    padrão é OK porque tabelas têm volume baixo. Em prod com Supabase,
--    Document tem ordem de centenas/milhares — aceitável bloquear breve.)
CREATE INDEX "Document_caseId_idx" ON "Document"("caseId");
CREATE INDEX "Document_workspaceId_updatedAt_idx" ON "Document"("workspaceId", "updatedAt");
CREATE UNIQUE INDEX "Case_processId_key" ON "Case"("processId");
CREATE UNIQUE INDEX "CaseLegalSource_caseId_chunkId_key" ON "CaseLegalSource"("caseId", "chunkId");
CREATE INDEX "CaseLegalSource_caseId_createdAt_idx" ON "CaseLegalSource"("caseId", "createdAt");
CREATE INDEX "CaseLegalSource_chunkId_idx" ON "CaseLegalSource"("chunkId");

-- 5. Foreign keys (ON DELETE rules conservadoras)
ALTER TABLE "Document"
    ADD CONSTRAINT "Document_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "Case"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Case"
    ADD CONSTRAINT "Case_processId_fkey"
    FOREIGN KEY ("processId") REFERENCES "Process"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CaseLegalSource"
    ADD CONSTRAINT "CaseLegalSource_caseId_fkey"
    FOREIGN KEY ("caseId") REFERENCES "Case"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
