-- JustOS Pro: idempotência billing Asaas
CREATE TABLE "JustosBillingEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'asaas',
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "workspaceId" TEXT,
    "rawHash" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JustosBillingEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "JustosBillingEvent_provider_eventId_key" ON "JustosBillingEvent"("provider", "eventId");
CREATE INDEX "JustosBillingEvent_workspaceId_createdAt_idx" ON "JustosBillingEvent"("workspaceId", "createdAt");
