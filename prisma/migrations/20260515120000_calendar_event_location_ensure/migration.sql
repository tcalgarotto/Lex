-- Idempotent: bases that already had CalendarEvent without "location" (CREATE before this fix).
ALTER TABLE "CalendarEvent" ADD COLUMN IF NOT EXISTS "location" TEXT;
