-- F12 — Biblioteca real: fundamentos salvos (1ª classe)

DO $$ BEGIN
  CREATE TYPE "LibraryFoundationScope" AS ENUM ('WORKSPACE','USER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "LibraryFoundation" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "scope" "LibraryFoundationScope" NOT NULL DEFAULT 'WORKSPACE',
  "ownerUserId" TEXT,
  "title" TEXT NOT NULL,
  "contentMd" TEXT NOT NULL,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "sourceJson" JSONB,
  "optInRag" BOOLEAN NOT NULL DEFAULT false,
  "optInMemory" BOOLEAN NOT NULL DEFAULT false,
  "useAsModel" BOOLEAN NOT NULL DEFAULT false,
  "useAsStyle" BOOLEAN NOT NULL DEFAULT false,
  "archivedAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "LibraryFoundation" ADD CONSTRAINT "LibraryFoundation_pkey" PRIMARY KEY ("id");
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "LibraryFoundation_workspaceId_idx" ON "LibraryFoundation"("workspaceId");
CREATE INDEX IF NOT EXISTS "LibraryFoundation_workspaceId_archivedAt_idx" ON "LibraryFoundation"("workspaceId","archivedAt");
CREATE INDEX IF NOT EXISTS "LibraryFoundation_workspaceId_deletedAt_idx" ON "LibraryFoundation"("workspaceId","deletedAt");
CREATE INDEX IF NOT EXISTS "LibraryFoundation_workspaceId_updatedAt_idx" ON "LibraryFoundation"("workspaceId","updatedAt");

DO $$ BEGIN
  ALTER TABLE "LibraryFoundation" ADD CONSTRAINT "LibraryFoundation_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "LibraryFoundation" ADD CONSTRAINT "LibraryFoundation_ownerUserId_fkey"
    FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "LibraryFoundation" ADD CONSTRAINT "LibraryFoundation_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

