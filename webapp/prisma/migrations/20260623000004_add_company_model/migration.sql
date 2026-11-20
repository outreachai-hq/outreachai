-- Plan 3 (Iter 15) — Company model + companyId on Contact / Lead.
-- All additive. Existing Contact.company / Lead.company text columns are
-- kept as cached display strings (mirror Company.name). companyId stays
-- NULL on existing rows; Iter 19 backfill links them up.

CREATE TABLE IF NOT EXISTS "Company" (
    "id"             TEXT NOT NULL,
    "userId"         TEXT NOT NULL,

    "name"           TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "domain"         TEXT,
    "websiteUrl"     TEXT,
    "linkedinUrl"    TEXT,

    "industry"       TEXT,
    "market"         TEXT,
    "type"           TEXT,
    "size"           TEXT,
    "employeeCount"  INTEGER,
    "foundedYear"    INTEGER,

    "city"           TEXT,
    "state"          TEXT,
    "region"         TEXT,
    "country"        TEXT,

    "technologies"   TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "lastFundingDate"   TIMESTAMP(3),
    "lastFundingAmount" INTEGER,
    "lastFundingStage"  TEXT,

    "notes"          TEXT,
    "tags"           TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

    "contactCount"   INTEGER NOT NULL DEFAULT 0,
    "leadCount"      INTEGER NOT NULL DEFAULT 0,
    "lastActivityAt" TIMESTAMP(3),

    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Company_userId_normalizedName_key"
    ON "Company"("userId", "normalizedName");
CREATE INDEX IF NOT EXISTS "Company_userId_name_idx"      ON "Company"("userId", "name");
CREATE INDEX IF NOT EXISTS "Company_userId_industry_idx"  ON "Company"("userId", "industry");
CREATE INDEX IF NOT EXISTS "Company_userId_country_idx"   ON "Company"("userId", "country");
CREATE INDEX IF NOT EXISTS "Company_userId_domain_idx"    ON "Company"("userId", "domain");

ALTER TABLE "Company" ADD CONSTRAINT "Company_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Contact.companyId
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
CREATE INDEX IF NOT EXISTS "Contact_companyId_idx" ON "Contact"("companyId");
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Lead.companyId
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
CREATE INDEX IF NOT EXISTS "Lead_companyId_idx" ON "Lead"("companyId");
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
