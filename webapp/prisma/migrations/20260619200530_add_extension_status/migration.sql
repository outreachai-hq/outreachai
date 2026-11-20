-- AlterTable
ALTER TABLE "User" ADD COLUMN     "extensionConnected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "extensionConnectedAt" TIMESTAMP(3);
