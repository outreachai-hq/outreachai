-- Plan 5 — Custom fields + AI columns.
--
-- CustomFieldDef rows describe a user's per-entity column definitions.
-- Values themselves live inline on the entity row as JSON to avoid EAV pain.
-- Idempotent: migrate-prod.ts swallows 42P07/42701/42710 errors, so re-runs
-- against an already-migrated DB are no-ops.

-- ── CustomFieldDef ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "CustomFieldDef" (
    "id"           TEXT NOT NULL,
    "userId"       TEXT NOT NULL,
    "entity"       TEXT NOT NULL,
    "key"          TEXT NOT NULL,
    "label"        TEXT NOT NULL,
    "type"         TEXT NOT NULL,
    "options"      JSONB,
    "defaultValue" JSONB,
    "aiPrompt"     TEXT,
    "aiProvider"   TEXT,
    "aiModel"      TEXT,
    "aiMaxTokens"  INTEGER DEFAULT 200,
    "aiAutoRun"    BOOLEAN NOT NULL DEFAULT false,
    "position"     INTEGER NOT NULL DEFAULT 0,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomFieldDef_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomFieldDef_userId_entity_key_key" ON "CustomFieldDef"("userId", "entity", "key");
CREATE INDEX IF NOT EXISTS "CustomFieldDef_userId_entity_position_idx" ON "CustomFieldDef"("userId", "entity", "position");
ALTER TABLE "CustomFieldDef" ADD CONSTRAINT "CustomFieldDef_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Lead.customFields / aiColumnRuns ─────────────────────────────────────────
ALTER TABLE "Lead" ADD COLUMN "customFields" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "Lead" ADD COLUMN "aiColumnRuns" JSONB NOT NULL DEFAULT '{}';

-- ── Contact.customFields / aiColumnRuns ──────────────────────────────────────
ALTER TABLE "Contact" ADD COLUMN "customFields" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "Contact" ADD COLUMN "aiColumnRuns" JSONB NOT NULL DEFAULT '{}';

-- ── Company.customFields / aiColumnRuns ──────────────────────────────────────
ALTER TABLE "Company" ADD COLUMN "customFields" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "Company" ADD COLUMN "aiColumnRuns" JSONB NOT NULL DEFAULT '{}';
