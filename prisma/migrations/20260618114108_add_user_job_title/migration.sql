/*
  Warnings:

  - You are about to drop the column `ollamaModel` on the `AppSettings` table. All the data in the column will be lost.
  - You are about to drop the column `ollamaUrl` on the `AppSettings` table. All the data in the column will be lost.
  - You are about to drop the `AIChatMessage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AIDigest` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "AIChatMessage" DROP CONSTRAINT "AIChatMessage_userId_fkey";

-- DropIndex
DROP INDEX "KeyResult_objectiveId_idx";

-- DropIndex
DROP INDEX "Objective_position_idx";

-- AlterTable
ALTER TABLE "AppSettings" DROP COLUMN "ollamaModel",
DROP COLUMN "ollamaUrl";

-- AlterTable
ALTER TABLE "KeyResult" ALTER COLUMN "startDate" DROP DEFAULT,
ALTER COLUMN "endDate" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "jobTitle" TEXT;

-- DropTable
DROP TABLE "AIChatMessage";

-- DropTable
DROP TABLE "AIDigest";
