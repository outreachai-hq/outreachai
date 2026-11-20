-- CreateTable
CREATE TABLE "CapturedPost" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "profileName" TEXT NOT NULL,
    "profileUrl" TEXT,
    "postText" TEXT NOT NULL,
    "postUrl" TEXT,
    "postedAt" TEXT,
    "likes" INTEGER,
    "comments" INTEGER,
    "twitterThread" TEXT,
    "linkedinRepost" TEXT,
    "newsletter" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CapturedPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CapturedPost_userId_profileId_idx" ON "CapturedPost"("userId", "profileId");

-- CreateIndex
CREATE INDEX "CapturedPost_userId_createdAt_idx" ON "CapturedPost"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "CapturedPost" ADD CONSTRAINT "CapturedPost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
