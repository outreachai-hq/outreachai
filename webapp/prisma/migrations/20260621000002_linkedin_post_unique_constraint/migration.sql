-- Add unique constraint on (userId, scheduledFor) to enable upsert
CREATE UNIQUE INDEX "LinkedInPost_userId_scheduledFor_key" ON "LinkedInPost"("userId", "scheduledFor");
