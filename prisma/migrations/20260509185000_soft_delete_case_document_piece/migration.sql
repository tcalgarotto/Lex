-- F11 — Soft delete support (archive + delete markers)

ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "Case" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

ALTER TABLE "LegalPiece" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "LegalPiece" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Case_workspaceId_archivedAt_idx" ON "Case"("workspaceId","archivedAt");
CREATE INDEX IF NOT EXISTS "Case_workspaceId_deletedAt_idx" ON "Case"("workspaceId","deletedAt");
CREATE INDEX IF NOT EXISTS "Document_workspaceId_archivedAt_idx" ON "Document"("workspaceId","archivedAt");
CREATE INDEX IF NOT EXISTS "Document_workspaceId_deletedAt_idx" ON "Document"("workspaceId","deletedAt");
CREATE INDEX IF NOT EXISTS "LegalPiece_workspaceId_archivedAt_idx" ON "LegalPiece"("workspaceId","archivedAt");
CREATE INDEX IF NOT EXISTS "LegalPiece_workspaceId_deletedAt_idx" ON "LegalPiece"("workspaceId","deletedAt");

