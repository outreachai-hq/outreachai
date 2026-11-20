CREATE TABLE IF NOT EXISTS "ActivityEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "contactName" TEXT,
    "contactProfileId" TEXT,
    "linkedinUrl" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ActivityEvent_userId_idx" ON "ActivityEvent"("userId");
CREATE INDEX IF NOT EXISTS "ActivityEvent_userId_createdAt_idx" ON "ActivityEvent"("userId", "createdAt" DESC);

ALTER TABLE "ActivityEvent" ADD CONSTRAINT "ActivityEvent_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
