-- Watchlist
CREATE TABLE IF NOT EXISTS "Watchlist" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "signalType" TEXT NOT NULL,
  "description" TEXT,
  "config" JSONB NOT NULL DEFAULT '{}',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Watchlist_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Watchlist_userId_active_idx" ON "Watchlist"("userId", "active");
ALTER TABLE "Watchlist" ADD CONSTRAINT "Watchlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

-- WatchlistSignal
CREATE TABLE IF NOT EXISTS "WatchlistSignal" (
  "id" TEXT NOT NULL,
  "watchlistId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "leadId" TEXT,
  "contactId" TEXT,
  "companyId" TEXT,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "payload" JSONB,
  "firedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "consumed" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "WatchlistSignal_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WatchlistSignal_watchlistId_firedAt_idx" ON "WatchlistSignal"("watchlistId", "firedAt" DESC);
CREATE INDEX IF NOT EXISTS "WatchlistSignal_userId_firedAt_idx" ON "WatchlistSignal"("userId", "firedAt" DESC);
ALTER TABLE "WatchlistSignal" ADD CONSTRAINT "WatchlistSignal_watchlistId_fkey" FOREIGN KEY ("watchlistId") REFERENCES "Watchlist"("id") ON DELETE CASCADE;

-- PhoneNumber
CREATE TABLE IF NOT EXISTS "PhoneNumber" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "label" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PhoneNumber_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PhoneNumber_userId_idx" ON "PhoneNumber"("userId");
ALTER TABLE "PhoneNumber" ADD CONSTRAINT "PhoneNumber_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

-- Call
CREATE TABLE IF NOT EXISTS "Call" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "leadId" TEXT,
  "contactId" TEXT,
  "campaignId" TEXT,
  "phoneNumberId" TEXT,
  "fromNumber" TEXT,
  "toNumber" TEXT NOT NULL,
  "direction" TEXT NOT NULL DEFAULT 'outbound',
  "status" TEXT NOT NULL DEFAULT 'completed',
  "durationSec" INTEGER,
  "notes" TEXT,
  "outcome" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Call_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Call_userId_startedAt_idx" ON "Call"("userId", "startedAt" DESC);
ALTER TABLE "Call" ADD CONSTRAINT "Call_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

-- CampaignLead auto-stop
ALTER TABLE "CampaignLead" ADD COLUMN IF NOT EXISTS "autoStopped" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CampaignLead" ADD COLUMN IF NOT EXISTS "stoppedReason" TEXT;
