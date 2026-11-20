-- Plan 9 — Composable Dashboards.
-- Widget data is queried on-demand from existing tables; only the config
-- JSON lives here. Idempotent against migrate-prod.ts.

CREATE TABLE IF NOT EXISTS "Dashboard" (
    "id"          TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "tabs"        JSONB NOT NULL DEFAULT '[]',
    "filters"     JSONB NOT NULL DEFAULT '{}',
    "shareToken"  TEXT,
    "sharedAt"    TIMESTAMP(3),
    "position"    INTEGER NOT NULL DEFAULT 0,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Dashboard_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Dashboard_shareToken_key" ON "Dashboard"("shareToken");
CREATE INDEX IF NOT EXISTS "Dashboard_userId_position_idx"   ON "Dashboard"("userId", "position");
ALTER TABLE "Dashboard" ADD CONSTRAINT "Dashboard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
