-- CreateEnum
CREATE TYPE "BetaLeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'DISCARDED');

-- AlterTable
ALTER TABLE "BetaLeadRequest" ADD COLUMN "status" "BetaLeadStatus" NOT NULL DEFAULT 'NEW';
ALTER TABLE "BetaLeadRequest" ADD COLUMN "utmSource" TEXT;
ALTER TABLE "BetaLeadRequest" ADD COLUMN "utmMedium" TEXT;
ALTER TABLE "BetaLeadRequest" ADD COLUMN "utmCampaign" TEXT;
ALTER TABLE "BetaLeadRequest" ADD COLUMN "utmContent" TEXT;
ALTER TABLE "BetaLeadRequest" ADD COLUMN "utmTerm" TEXT;
ALTER TABLE "BetaLeadRequest" ADD COLUMN "referrer" TEXT;
ALTER TABLE "BetaLeadRequest" ADD COLUMN "notes" TEXT;
ALTER TABLE "BetaLeadRequest" ADD COLUMN "contactedAt" TIMESTAMP(3);
ALTER TABLE "BetaLeadRequest" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "BetaLeadRequest_status_idx" ON "BetaLeadRequest"("status");
