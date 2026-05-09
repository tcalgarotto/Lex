-- F3.5 — adiciona vínculo opcional de chunk filho (chunker v3) ao seu pai.

ALTER TABLE "LegalChunk" ADD COLUMN IF NOT EXISTS "parentChunkId" TEXT;
CREATE INDEX IF NOT EXISTS "LegalChunk_parentChunkId_idx" ON "LegalChunk" ("parentChunkId");
