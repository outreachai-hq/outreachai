-- Add per-user LinkedIn OAuth app credentials (BYOK)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "linkedInClientId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "linkedInClientSecret" TEXT;
