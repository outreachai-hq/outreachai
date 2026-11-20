-- Catch-up migration: objects that were created in production with `prisma db push`
-- and never had a migration, so fresh installs were missing them.
-- Purely additive and idempotent: in production every statement already exists and
-- is skipped (IF NOT EXISTS, or 42710 "duplicate object" via scripts/migrate-prod.ts).
-- Intentionally omitted cosmetic drift: FK onDelete changes on Call/Deal/Watchlist/
-- PhoneNumber/DeliverabilityAlert, dropping LinkedInPost_userId_idx, updatedAt defaults.

ALTER TABLE "EmailAccount" ADD COLUMN IF NOT EXISTS "dailySendCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "dailySendResetAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "sesConfigurationSet" TEXT DEFAULT 'mytaxesfilings-bulk';

ALTER TABLE "LinkedInAccount" ADD COLUMN IF NOT EXISTS "linkedInScope" TEXT;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "linkedInPostHour" INTEGER NOT NULL DEFAULT 19,
ADD COLUMN IF NOT EXISTS "linkedInPostTz" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
ADD COLUMN IF NOT EXISTS "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "onboardingStep" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "workspaceId" TEXT;

CREATE TABLE IF NOT EXISTS "LinkedInAction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campaignLeadId" TEXT,
    "campaignId" TEXT,
    "leadId" TEXT,
    "profileId" TEXT NOT NULL,
    "profileUrl" TEXT,
    "actionType" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "pickedUpAt" TIMESTAMP(3),
    "doneAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LinkedInAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MarketingCampaign" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "htmlBody" TEXT NOT NULL,
    "fromName" TEXT NOT NULL,
    "emailAccountId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "recipientListId" TEXT NOT NULL,
    "stats" JSONB NOT NULL DEFAULT '{}',
    "abEnabled" BOOLEAN NOT NULL DEFAULT false,
    "abSubjectB" TEXT,
    "abSplitPercent" INTEGER NOT NULL DEFAULT 20,
    "abWinnerMetric" TEXT NOT NULL DEFAULT 'open',
    "abTestDurationHours" INTEGER NOT NULL DEFAULT 4,
    "abWinner" TEXT,
    "abWinnerSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MarketingCampaignSend" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "leadEmail" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "trackingId" TEXT NOT NULL,
    "sesMessageId" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "complainedAt" TIMESTAMP(3),
    "unsubscribedAt" TIMESTAMP(3),
    "abVariant" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingCampaignSend_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Unsubscribe" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Unsubscribe_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WarmupAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailAccountId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "dailyTarget" INTEGER NOT NULL DEFAULT 5,
    "currentDay" INTEGER NOT NULL DEFAULT 0,
    "totalSent" INTEGER NOT NULL DEFAULT 0,
    "totalReceived" INTEGER NOT NULL DEFAULT 0,
    "totalReplied" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WarmupAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WarmupEmail" (
    "id" TEXT NOT NULL,
    "warmupAccountId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "fromEmail" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "messageId" TEXT,
    "replied" BOOLEAN NOT NULL DEFAULT false,
    "repliedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WarmupEmail_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WorkspaceMember" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WorkspaceInvite" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "token" TEXT NOT NULL,
    "invitedById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceInvite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "IssueReport" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'bug',
    "email" TEXT,
    "url" TEXT,
    "userAgent" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IssueReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LinkedInAction_userId_status_idx" ON "LinkedInAction"("userId", "status");

CREATE INDEX IF NOT EXISTS "LinkedInAction_profileId_idx" ON "LinkedInAction"("profileId");

CREATE INDEX IF NOT EXISTS "MarketingCampaign_userId_idx" ON "MarketingCampaign"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "MarketingCampaignSend_trackingId_key" ON "MarketingCampaignSend"("trackingId");

CREATE INDEX IF NOT EXISTS "MarketingCampaignSend_campaignId_idx" ON "MarketingCampaignSend"("campaignId");

CREATE INDEX IF NOT EXISTS "MarketingCampaignSend_trackingId_idx" ON "MarketingCampaignSend"("trackingId");

CREATE INDEX IF NOT EXISTS "MarketingCampaignSend_sesMessageId_idx" ON "MarketingCampaignSend"("sesMessageId");

CREATE INDEX IF NOT EXISTS "Unsubscribe_userId_idx" ON "Unsubscribe"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "Unsubscribe_email_userId_key" ON "Unsubscribe"("email", "userId");

CREATE UNIQUE INDEX IF NOT EXISTS "WarmupAccount_emailAccountId_key" ON "WarmupAccount"("emailAccountId");

CREATE INDEX IF NOT EXISTS "WarmupAccount_userId_idx" ON "WarmupAccount"("userId");

CREATE INDEX IF NOT EXISTS "WarmupEmail_warmupAccountId_idx" ON "WarmupEmail"("warmupAccountId");

CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceMember_workspaceId_userId_key" ON "WorkspaceMember"("workspaceId", "userId");

CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceInvite_token_key" ON "WorkspaceInvite"("token");

CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceInvite_workspaceId_email_key" ON "WorkspaceInvite"("workspaceId", "email");

CREATE INDEX IF NOT EXISTS "IssueReport_status_idx" ON "IssueReport"("status");

CREATE INDEX IF NOT EXISTS "IssueReport_createdAt_idx" ON "IssueReport"("createdAt");

ALTER TABLE "LinkedInAction" ADD CONSTRAINT "LinkedInAction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_emailAccountId_fkey" FOREIGN KEY ("emailAccountId") REFERENCES "EmailAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_recipientListId_fkey" FOREIGN KEY ("recipientListId") REFERENCES "LeadList"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MarketingCampaignSend" ADD CONSTRAINT "MarketingCampaignSend_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MarketingCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MarketingCampaignSend" ADD CONSTRAINT "MarketingCampaignSend_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Unsubscribe" ADD CONSTRAINT "Unsubscribe_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WarmupAccount" ADD CONSTRAINT "WarmupAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WarmupAccount" ADD CONSTRAINT "WarmupAccount_emailAccountId_fkey" FOREIGN KEY ("emailAccountId") REFERENCES "EmailAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WarmupEmail" ADD CONSTRAINT "WarmupEmail_warmupAccountId_fkey" FOREIGN KEY ("warmupAccountId") REFERENCES "WarmupAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Workspace" ADD CONSTRAINT "Workspace_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkspaceInvite" ADD CONSTRAINT "WorkspaceInvite_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkspaceInvite" ADD CONSTRAINT "WorkspaceInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Call" ADD CONSTRAINT "Call_phoneNumberId_fkey" FOREIGN KEY ("phoneNumberId") REFERENCES "PhoneNumber"("id") ON DELETE SET NULL ON UPDATE CASCADE;
