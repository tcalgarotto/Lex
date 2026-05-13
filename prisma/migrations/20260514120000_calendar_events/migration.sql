-- CreateEnum
CREATE TYPE "CalendarEventType" AS ENUM ('CLIENT_MEETING', 'HEARING', 'REVIEW_DEADLINE', 'REVIEW_COMMUNICATION', 'FOLLOW_UP', 'INTERNAL_TASK', 'OTHER');

-- CreateEnum
CREATE TYPE "CalendarEventStatus" AS ENUM ('PENDING', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CalendarEventSource" AS ENUM ('MANUAL', 'OFFICIAL_COMMUNICATION', 'OTHER');

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "caseId" TEXT,
    "legalProcessId" TEXT,
    "processId" TEXT,
    "documentId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "eventType" "CalendarEventType" NOT NULL DEFAULT 'OTHER',
    "status" "CalendarEventStatus" NOT NULL DEFAULT 'PENDING',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "assignedToUserId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "source" "CalendarEventSource" NOT NULL DEFAULT 'MANUAL',
    "sourceRefId" TEXT,
    "requiresHumanReview" BOOLEAN NOT NULL DEFAULT false,
    "reminderMinutesBefore" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalendarEvent_workspaceId_startsAt_idx" ON "CalendarEvent"("workspaceId", "startsAt");

-- CreateIndex
CREATE INDEX "CalendarEvent_workspaceId_status_startsAt_idx" ON "CalendarEvent"("workspaceId", "status", "startsAt");

-- CreateIndex
CREATE INDEX "CalendarEvent_caseId_startsAt_idx" ON "CalendarEvent"("caseId", "startsAt");

-- CreateIndex
CREATE INDEX "CalendarEvent_legalProcessId_startsAt_idx" ON "CalendarEvent"("legalProcessId", "startsAt");

-- CreateIndex
CREATE INDEX "CalendarEvent_processId_startsAt_idx" ON "CalendarEvent"("processId", "startsAt");

-- CreateIndex
CREATE INDEX "CalendarEvent_documentId_idx" ON "CalendarEvent"("documentId");

-- CreateIndex
CREATE INDEX "CalendarEvent_assignedToUserId_startsAt_idx" ON "CalendarEvent"("assignedToUserId", "startsAt");

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_legalProcessId_fkey" FOREIGN KEY ("legalProcessId") REFERENCES "LegalProcess"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
