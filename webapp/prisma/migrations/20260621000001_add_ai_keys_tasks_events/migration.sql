-- AlterTable: Lead enrichment columns
ALTER TABLE "Lead" ADD COLUMN "aboutSection" TEXT,
ADD COLUMN "clickCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastClickedAt" TIMESTAMP(3),
ADD COLUMN "lastOpenedAt" TIMESTAMP(3),
ADD COLUMN "openCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "phone" TEXT,
ADD COLUMN "recentPost" TEXT,
ADD COLUMN "score" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable: AI provider keys on User
ALTER TABLE "User" ADD COLUMN "aiKeyAnthropic" TEXT,
ADD COLUMN "aiKeyGemini" TEXT,
ADD COLUMN "aiKeyOpenai" TEXT;

-- CreateTable: Task
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leadId" TEXT,
    "campaignId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'custom',
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable: EmailEvent
CREATE TABLE "EmailEvent" (
    "id" TEXT NOT NULL,
    "trackingId" TEXT NOT NULL,
    "leadId" TEXT,
    "campaignId" TEXT,
    "type" TEXT NOT NULL,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Task_userId_idx" ON "Task"("userId");
CREATE INDEX "Task_dueAt_idx" ON "Task"("dueAt");
CREATE INDEX "EmailEvent_trackingId_idx" ON "EmailEvent"("trackingId");
CREATE INDEX "EmailEvent_leadId_idx" ON "EmailEvent"("leadId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
