-- CreateTable
CREATE TABLE "BetaLeadRequest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "role" TEXT,
    "teamSize" TEXT NOT NULL,
    "mainPain" TEXT,
    "intent" TEXT NOT NULL DEFAULT 'beta',
    "contactConsent" BOOLEAN NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'landing',
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BetaLeadRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BetaLeadRequest_email_idx" ON "BetaLeadRequest"("email");

-- CreateIndex
CREATE INDEX "BetaLeadRequest_createdAt_idx" ON "BetaLeadRequest"("createdAt");
