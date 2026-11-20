-- AlterTable
ALTER TABLE "LinkedInAccount" ADD COLUMN     "accessToken" TEXT,
ADD COLUMN     "linkedInMemberId" TEXT,
ADD COLUMN     "refreshToken" TEXT,
ADD COLUMN     "tokenExpiry" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "LinkedInPost" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "linkedInAccountId" TEXT,
    "content" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "postedAt" TIMESTAMP(3),
    "linkedInPostId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LinkedInPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LinkedInPost_userId_idx" ON "LinkedInPost"("userId");

-- CreateIndex
CREATE INDEX "LinkedInPost_status_scheduledFor_idx" ON "LinkedInPost"("status", "scheduledFor");

-- AddForeignKey
ALTER TABLE "LinkedInPost" ADD CONSTRAINT "LinkedInPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LinkedInPost" ADD CONSTRAINT "LinkedInPost_linkedInAccountId_fkey" FOREIGN KEY ("linkedInAccountId") REFERENCES "LinkedInAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
