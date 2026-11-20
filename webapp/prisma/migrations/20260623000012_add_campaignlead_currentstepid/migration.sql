-- Plan 6 — CampaignLead.currentStepId for step lookup by id.
-- Legacy rows leave it NULL; the runner falls back to currentStep (index).

ALTER TABLE "CampaignLead" ADD COLUMN "currentStepId" TEXT;
