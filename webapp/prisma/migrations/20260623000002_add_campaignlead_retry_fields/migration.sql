-- Iter 8 — SMTP retry + bounce handling on CampaignLead.
-- Adds attempt counter, last error message, last attempt timestamp.
-- All additive with defaults; existing rows get attempts=0 and nulls.

ALTER TABLE "CampaignLead" ADD COLUMN IF NOT EXISTS "attempts"      INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CampaignLead" ADD COLUMN IF NOT EXISTS "lastError"     TEXT;
ALTER TABLE "CampaignLead" ADD COLUMN IF NOT EXISTS "lastAttemptAt" TIMESTAMP(3);
