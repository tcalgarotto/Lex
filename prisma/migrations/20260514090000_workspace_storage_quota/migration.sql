-- P0: quota de armazenamento por workspace (nuvem de documentos).
ALTER TABLE "Workspace" ADD COLUMN "storageQuotaBytes" BIGINT NOT NULL DEFAULT 2147483648;
ALTER TABLE "Workspace" ADD COLUMN "storageUsedBytes" BIGINT NOT NULL DEFAULT 0;
