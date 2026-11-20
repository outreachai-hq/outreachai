-- Plan 4 (Iter 20) — per-lead activity timeline.
-- Pure additive: existing code keeps working unchanged; emit sites get
-- wired in Iters 21-22.

CREATE TABLE IF NOT EXISTS "LeadActivity" (
    "id"             TEXT NOT NULL,
    "userId"         TEXT NOT NULL,

    "leadId"         TEXT,
    "contactId"      TEXT,
    "companyId"      TEXT,

    "type"           TEXT NOT NULL,
    "channel"        TEXT,
    "source"         TEXT,

    "campaignId"     TEXT,
    "sequenceStepId" TEXT,
    "conversationId" TEXT,
    "messageId"      TEXT,
    "taskId"         TEXT,

    "title"          TEXT NOT NULL,
    "body"           TEXT,
    "payload"        JSONB,

    "occurredAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId"    TEXT,

    CONSTRAINT "LeadActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LeadActivity_userId_leadId_occurredAt_idx"
    ON "LeadActivity"("userId", "leadId", "occurredAt" DESC);
CREATE INDEX IF NOT EXISTS "LeadActivity_userId_contactId_occurredAt_idx"
    ON "LeadActivity"("userId", "contactId", "occurredAt" DESC);
CREATE INDEX IF NOT EXISTS "LeadActivity_userId_companyId_occurredAt_idx"
    ON "LeadActivity"("userId", "companyId", "occurredAt" DESC);
CREATE INDEX IF NOT EXISTS "LeadActivity_userId_occurredAt_idx"
    ON "LeadActivity"("userId", "occurredAt" DESC);
CREATE INDEX IF NOT EXISTS "LeadActivity_campaignId_occurredAt_idx"
    ON "LeadActivity"("campaignId", "occurredAt" DESC);

ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_leadId_fkey"
    FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LeadActivity" ADD CONSTRAINT "LeadActivity_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
