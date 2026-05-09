-- F19 — Memória do escritório / caso / usuário (opt-in explícito)

CREATE TYPE "OfficeMemoryScope" AS ENUM ('WORKSPACE', 'USER', 'CASE');

CREATE TABLE "OfficeMemory" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "scope" "OfficeMemoryScope" NOT NULL,
    "caseId" TEXT,
    "ownerUserId" TEXT,
    "title" TEXT NOT NULL,
    "contentMd" TEXT NOT NULL,
    "useAsModel" BOOLEAN NOT NULL DEFAULT false,
    "useAsStyle" BOOLEAN NOT NULL DEFAULT false,
    "optInRag" BOOLEAN NOT NULL DEFAULT false,
    "private" BOOLEAN NOT NULL DEFAULT false,
    "originType" TEXT,
    "originId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "archivedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficeMemory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OfficeMemory_workspaceId_idx" ON "OfficeMemory"("workspaceId");
CREATE INDEX "OfficeMemory_workspaceId_scope_idx" ON "OfficeMemory"("workspaceId", "scope");
CREATE INDEX "OfficeMemory_workspaceId_deletedAt_idx" ON "OfficeMemory"("workspaceId", "deletedAt");
CREATE INDEX "OfficeMemory_caseId_idx" ON "OfficeMemory"("caseId");
CREATE INDEX "OfficeMemory_ownerUserId_idx" ON "OfficeMemory"("ownerUserId");

ALTER TABLE "OfficeMemory" ADD CONSTRAINT "OfficeMemory_workspaceId_fkey"
  FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OfficeMemory" ADD CONSTRAINT "OfficeMemory_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OfficeMemory" ADD CONSTRAINT "OfficeMemory_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OfficeMemory" ADD CONSTRAINT "OfficeMemory_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OfficeMemory" ADD CONSTRAINT "OfficeMemory_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
