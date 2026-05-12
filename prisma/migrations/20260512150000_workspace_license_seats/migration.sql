-- Licenças de workspace (lugares = membros + convites pendentes não expirados).
CREATE TYPE "WorkspaceLicense" AS ENUM ('INVESTOR', 'SOLO', 'DUO', 'TEAM', 'ENTERPRISE');

ALTER TABLE "Workspace" ADD COLUMN "license" "WorkspaceLicense" NOT NULL DEFAULT 'ENTERPRISE';
ALTER TABLE "Workspace" ADD COLUMN "customSeatLimit" INTEGER;
