-- CreateTable
CREATE TABLE "Trophy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "imageKey" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TrophyWin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "trophyId" TEXT NOT NULL,
    "wonAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    CONSTRAINT "TrophyWin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TrophyWin_trophyId_fkey" FOREIGN KEY ("trophyId") REFERENCES "Trophy" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- AlterTable
ALTER TABLE "Round" ADD COLUMN "trophyId" TEXT;

-- AlterTable
ALTER TABLE "QuestionUsage" ADD COLUMN "trophyId" TEXT;

-- AlterTable
ALTER TABLE "CategoryGame" ADD COLUMN "trophyId" TEXT;

-- CreateIndex
CREATE INDEX "TrophyWin_userId_idx" ON "TrophyWin"("userId");

-- CreateIndex
CREATE INDEX "TrophyWin_trophyId_idx" ON "TrophyWin"("trophyId");


