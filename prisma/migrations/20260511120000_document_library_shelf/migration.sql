-- Catálogo da biblioteca (partilhado vs. privado) + remetente do upload.
-- Migração isolada para não acionar alterações noutras tabelas (ex.: LegalChunk gerado).

DO $$
BEGIN
  CREATE TYPE "DocumentLibraryShelf" AS ENUM ('OFFICE_PRIVATE', 'SHARED_LEGAL', 'SHARED_BOOKS');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "uploadedByUserId" TEXT;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "libraryShelf" "DocumentLibraryShelf" NOT NULL DEFAULT 'OFFICE_PRIVATE';

DO $$
BEGIN
  ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedByUserId_fkey"
    FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Document_workspaceId_libraryShelf_idx" ON "Document"("workspaceId", "libraryShelf");
CREATE INDEX IF NOT EXISTS "Document_uploadedByUserId_idx" ON "Document"("uploadedByUserId");
