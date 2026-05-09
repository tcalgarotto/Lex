-- Add metadataJson to CaseFact for inline CRUD (source/status/confidence, evidence refs).
ALTER TABLE "CaseFact" ADD COLUMN IF NOT EXISTS "metadataJson" JSONB;

