CREATE TABLE IF NOT EXISTS "DeliverabilityAlert" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "metric" TEXT NOT NULL,
  "condition" TEXT NOT NULL,
  "threshold" DOUBLE PRECISION NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeliverabilityAlert_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DeliverabilityAlert_userId_idx" ON "DeliverabilityAlert"("userId");
ALTER TABLE "DeliverabilityAlert" ADD CONSTRAINT "DeliverabilityAlert_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;
