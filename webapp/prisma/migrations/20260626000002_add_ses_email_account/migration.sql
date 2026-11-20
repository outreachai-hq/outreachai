ALTER TABLE "EmailAccount" ADD COLUMN IF NOT EXISTS "awsRegion"          TEXT;
ALTER TABLE "EmailAccount" ADD COLUMN IF NOT EXISTS "awsAccessKeyId"     TEXT;
ALTER TABLE "EmailAccount" ADD COLUMN IF NOT EXISTS "awsSecretAccessKey" TEXT;
