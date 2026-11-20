CREATE TABLE IF NOT EXISTS "Pipeline" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL DEFAULT 'Sales Pipeline',
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Pipeline_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Pipeline_userId_idx" ON "Pipeline"("userId");
ALTER TABLE "Pipeline" ADD CONSTRAINT "Pipeline_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "PipelineStage" (
  "id" TEXT NOT NULL,
  "pipelineId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "probability" INTEGER NOT NULL DEFAULT 50,
  "type" TEXT NOT NULL DEFAULT 'open',
  "color" TEXT NOT NULL DEFAULT '#6366f1',
  CONSTRAINT "PipelineStage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PipelineStage_pipelineId_position_idx" ON "PipelineStage"("pipelineId", "position");
ALTER TABLE "PipelineStage" ADD CONSTRAINT "PipelineStage_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "Deal" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "pipelineId" TEXT NOT NULL,
  "stageId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "value" DOUBLE PRECISION,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "closeDate" TIMESTAMP(3),
  "probability" INTEGER,
  "description" TEXT,
  "lostReason" TEXT,
  "contactId" TEXT,
  "companyId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'open',
  "wonAt" TIMESTAMP(3),
  "lostAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Deal_userId_stageId_idx" ON "Deal"("userId", "stageId");
CREATE INDEX IF NOT EXISTS "Deal_userId_status_idx" ON "Deal"("userId", "status");
CREATE INDEX IF NOT EXISTS "Deal_pipelineId_idx" ON "Deal"("pipelineId");
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "PipelineStage"("id") ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "DealActivity" (
  "id" TEXT NOT NULL,
  "dealId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT,
  "payload" JSONB,
  "actorUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DealActivity_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DealActivity_dealId_createdAt_idx" ON "DealActivity"("dealId", "createdAt" DESC);
ALTER TABLE "DealActivity" ADD CONSTRAINT "DealActivity_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealActivity" ADD CONSTRAINT "DealActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
