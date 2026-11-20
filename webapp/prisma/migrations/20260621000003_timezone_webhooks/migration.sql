-- Campaign: timezone + send window
ALTER TABLE "Campaign"
  ADD COLUMN "timezone"   TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  ADD COLUMN "sendWindow" JSONB NOT NULL DEFAULT '[8,18]';

-- Webhook tables
CREATE TABLE "WebhookEndpoint" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "url" TEXT NOT NULL,
  "events" TEXT NOT NULL, "secret" TEXT, "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "WebhookDelivery" (
  "id" TEXT NOT NULL, "endpointId" TEXT NOT NULL, "event" TEXT NOT NULL,
  "payload" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'pending',
  "statusCode" INTEGER, "attempts" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WebhookEndpoint_userId_idx" ON "WebhookEndpoint"("userId");
CREATE INDEX "WebhookDelivery_endpointId_idx" ON "WebhookDelivery"("endpointId");
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "WebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
