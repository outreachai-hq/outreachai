-- Plan 8 — Outreach Queue: DraftMessage model + User.aiReplyAutoDraft toggle.
-- Idempotent: scripts/migrate-prod.ts swallows 42P07 / 42701 / 42710 so
-- re-runs are no-ops.

CREATE TABLE IF NOT EXISTS "DraftMessage" (
    "id"             TEXT NOT NULL,
    "userId"         TEXT NOT NULL,
    "channel"        TEXT NOT NULL,
    "subject"        TEXT,
    "body"           TEXT NOT NULL,
    "htmlBody"       TEXT,
    "conversationId" TEXT,
    "leadId"         TEXT,
    "contactId"      TEXT,
    "campaignId"     TEXT,
    "sequenceStepId" TEXT,
    "status"         TEXT NOT NULL DEFAULT 'pending',
    "scheduledFor"   TIMESTAMP(3),
    "approvedAt"     TIMESTAMP(3),
    "rejectedAt"     TIMESTAMP(3),
    "sentAt"         TIMESTAMP(3),
    "sentMessageId"  TEXT,
    "createdByAi"    BOOLEAN NOT NULL DEFAULT true,
    "aiProvider"     TEXT,
    "aiModel"        TEXT,
    "aiPrompt"       TEXT,
    "source"         TEXT NOT NULL DEFAULT 'ai',
    "priority"       INTEGER NOT NULL DEFAULT 0,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DraftMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DraftMessage_userId_status_scheduledFor_idx"           ON "DraftMessage"("userId", "status", "scheduledFor");
CREATE INDEX IF NOT EXISTS "DraftMessage_userId_status_priority_createdAt_idx"     ON "DraftMessage"("userId", "status", "priority" DESC, "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "DraftMessage_conversationId_idx"                       ON "DraftMessage"("conversationId");
ALTER TABLE "DraftMessage" ADD CONSTRAINT "DraftMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "User" ADD COLUMN "aiReplyAutoDraft" TEXT NOT NULL DEFAULT 'off';
