-- AlterTable
ALTER TABLE "EmailAccount" ADD COLUMN     "imapHost" TEXT,
ADD COLUMN     "imapPort" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "passwordResetExpiry" TIMESTAMP(3),
ADD COLUMN     "passwordResetToken" TEXT;
