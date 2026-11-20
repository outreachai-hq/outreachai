CREATE TABLE IF NOT EXISTS "Workflow" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL, "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "triggerKey" TEXT NOT NULL,
  "conditions" JSONB NOT NULL DEFAULT '[]',
  "actions" JSONB NOT NULL DEFAULT '[]',
  "runCount" INTEGER NOT NULL DEFAULT 0,
  "lastRunAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Workflow_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Workflow_userId_active_idx" ON "Workflow"("userId", "active");
CREATE INDEX IF NOT EXISTS "Workflow_triggerKey_active_idx" ON "Workflow"("triggerKey", "active");
ALTER TABLE "Workflow" ADD CONSTRAINT "Workflow_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "WorkflowRun" (
  "id" TEXT NOT NULL, "workflowId" TEXT NOT NULL,
  "userId" TEXT NOT NULL, "entityId" TEXT, "entityType" TEXT,
  "result" TEXT NOT NULL, "error" TEXT,
  "actionsRun" INTEGER NOT NULL DEFAULT 0,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkflowRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WorkflowRun_workflowId_createdAt_idx" ON "WorkflowRun"("workflowId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "WorkflowRun_userId_createdAt_idx"     ON "WorkflowRun"("userId", "createdAt" DESC);
ALTER TABLE "WorkflowRun" ADD CONSTRAINT "WorkflowRun_workflowId_fkey"
  FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
