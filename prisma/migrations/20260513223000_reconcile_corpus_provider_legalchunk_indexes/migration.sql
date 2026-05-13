-- Reconcilia drift comum: enum alinhado ao `schema.prisma` e índices de `LegalChunk`
-- que existem no histórico de migrations mas podem faltar no banco remoto (ex.: Supabase).

DO $$ BEGIN
  ALTER TYPE "CorpusProvider" ADD VALUE 'CAMARA';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "CorpusProvider" ADD VALUE 'SENADO';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "LegalChunk_parentChunkId_idx" ON "LegalChunk" ("parentChunkId");

CREATE INDEX IF NOT EXISTS "LegalChunk_textTsv_gin" ON "LegalChunk" USING GIN ("textTsv");
