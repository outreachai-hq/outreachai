ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "websiteTrackingId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_websiteTrackingId_key" ON "User"("websiteTrackingId");

CREATE TABLE IF NOT EXISTS "WebsiteVisit" (
  "id"               TEXT NOT NULL,
  "userId"           TEXT NOT NULL,
  "trackingId"       TEXT NOT NULL,
  "ip"               TEXT,
  "resolvedOrg"      TEXT,
  "resolvedDomain"   TEXT,
  "matchedLeadId"    TEXT,
  "matchedContactId" TEXT,
  "matchedCompanyId" TEXT,
  "url"              TEXT,
  "referrer"         TEXT,
  "userAgent"        TEXT,
  "visitedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebsiteVisit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WebsiteVisit_userId_visitedAt_idx"   ON "WebsiteVisit"("userId", "visitedAt" DESC);
CREATE INDEX IF NOT EXISTS "WebsiteVisit_trackingId_visitedAt_idx" ON "WebsiteVisit"("trackingId", "visitedAt" DESC);
CREATE INDEX IF NOT EXISTS "WebsiteVisit_matchedLeadId_idx"      ON "WebsiteVisit"("matchedLeadId");
ALTER TABLE "WebsiteVisit" ADD CONSTRAINT "WebsiteVisit_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
