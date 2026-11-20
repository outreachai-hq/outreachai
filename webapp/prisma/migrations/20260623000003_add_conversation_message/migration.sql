-- Plan 2 (Iter 10) — channel-agnostic Conversation + Message tables.
-- Pure additive: existing InboxThread + EmailMessage stay untouched.
-- Reads + writes against these new tables get wired in Iter 11+.

CREATE TABLE IF NOT EXISTS "Conversation" (
    "id"                TEXT NOT NULL,
    "userId"            TEXT NOT NULL,

    "contactId"         TEXT,
    "leadId"            TEXT,
    "campaignId"        TEXT,

    "channel"           TEXT NOT NULL,
    "subject"           TEXT,

    "linkedinProfileId" TEXT,
    "emailThreadKey"    TEXT,
    "smsPhone"          TEXT,

    "participantName"   TEXT NOT NULL,
    "participantEmail"  TEXT,
    "participantUrl"    TEXT,
    "avatarUrl"         TEXT,

    "status"            TEXT NOT NULL DEFAULT 'open',
    "unread"            BOOLEAN NOT NULL DEFAULT false,
    "labels"            TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "lastMessageAt"     TIMESTAMP(3),
    "lastSenderIsMe"    BOOLEAN NOT NULL DEFAULT true,
    "syncedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Conversation_userId_channel_linkedinProfileId_key"
    ON "Conversation"("userId", "channel", "linkedinProfileId");
CREATE UNIQUE INDEX IF NOT EXISTS "Conversation_userId_channel_emailThreadKey_key"
    ON "Conversation"("userId", "channel", "emailThreadKey");

CREATE INDEX IF NOT EXISTS "Conversation_userId_status_lastMessageAt_idx"
    ON "Conversation"("userId", "status", "lastMessageAt" DESC);
CREATE INDEX IF NOT EXISTS "Conversation_userId_contactId_idx"
    ON "Conversation"("userId", "contactId");
CREATE INDEX IF NOT EXISTS "Conversation_userId_channel_idx"
    ON "Conversation"("userId", "channel");

ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


CREATE TABLE IF NOT EXISTS "Message" (
    "id"             TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "direction"      TEXT NOT NULL,
    "body"           TEXT NOT NULL,
    "html"           TEXT,
    "externalId"     TEXT,
    "attachments"    JSONB,
    "sentAt"         TIMESTAMP(3) NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Message_conversationId_sentAt_idx"
    ON "Message"("conversationId", "sentAt");
CREATE INDEX IF NOT EXISTS "Message_externalId_idx"
    ON "Message"("externalId");

ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
