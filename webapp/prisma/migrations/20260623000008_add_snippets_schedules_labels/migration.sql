-- Plan 7 — Snippets, Schedules, and ConversationLabels.
--
-- scripts/migrate-prod.ts splits on `;` and swallows "already exists"
-- (42P07 / 42701 / 42710) errors. So bare ADD CONSTRAINT / ADD COLUMN
-- statements are safe on retry — no DO blocks needed.

-- ── Snippet ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Snippet" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "key"       TEXT NOT NULL,
    "label"     TEXT NOT NULL,
    "body"      TEXT NOT NULL,
    "tags"      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Snippet_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Snippet_userId_key_key" ON "Snippet"("userId", "key");
CREATE INDEX IF NOT EXISTS "Snippet_userId_idx" ON "Snippet"("userId");
ALTER TABLE "Snippet" ADD CONSTRAINT "Snippet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Schedule ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Schedule" (
    "id"          TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "timezone"    TEXT NOT NULL,
    "weeklyHours" JSONB NOT NULL DEFAULT '{}',
    "holidays"    JSONB NOT NULL DEFAULT '[]',
    "isDefault"   BOOLEAN NOT NULL DEFAULT false,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Schedule_userId_idx" ON "Schedule"("userId");
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── ConversationLabel ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ConversationLabel" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "key"       TEXT NOT NULL,
    "label"     TEXT NOT NULL,
    "color"     TEXT NOT NULL DEFAULT '#888',
    "builtIn"   BOOLEAN NOT NULL DEFAULT false,
    "position"  INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConversationLabel_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ConversationLabel_userId_key_key" ON "ConversationLabel"("userId", "key");
CREATE INDEX IF NOT EXISTS "ConversationLabel_userId_idx" ON "ConversationLabel"("userId");
ALTER TABLE "ConversationLabel" ADD CONSTRAINT "ConversationLabel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Campaign.scheduleId ──────────────────────────────────────────────────────
ALTER TABLE "Campaign" ADD COLUMN "scheduleId" TEXT;
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
