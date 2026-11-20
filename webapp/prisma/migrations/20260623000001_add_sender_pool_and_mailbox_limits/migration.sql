-- Plan 1 — Email step in sequences + multi-mailbox sender rotation
-- Adds per-campaign sender pool and per-mailbox daily limits + signature + warmupActive flag.
-- All ALTERs use IF NOT EXISTS so the migrate-prod.ts idempotent runner is safe on a partial state.

ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "emailAccountIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "dailyEmailLimit" INTEGER NOT NULL DEFAULT 50;

ALTER TABLE "EmailAccount" ADD COLUMN IF NOT EXISTS "dailyLimit"   INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "EmailAccount" ADD COLUMN IF NOT EXISTS "signature"    TEXT;
ALTER TABLE "EmailAccount" ADD COLUMN IF NOT EXISTS "warmupActive" BOOLEAN NOT NULL DEFAULT false;
