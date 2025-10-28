/*
  Warnings:

  - You are about to drop the column `competitionId` on the `Question` table. All the data in the column will be lost.
  - You are about to drop the column `completedAt` on the `Question` table. All the data in the column will be lost.
  - You are about to drop the column `roundId` on the `Question` table. All the data in the column will be lost.
  - You are about to drop the column `sentAt` on the `Question` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Question` table. All the data in the column will be lost.
  - Added the required column `competitionId` to the `Answer` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "QuestionUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "roundId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "sentAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuestionUsage_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "QuestionUsage_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Answer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    "points" INTEGER NOT NULL DEFAULT 0,
    "reviewed" BOOLEAN NOT NULL DEFAULT false,
    "answeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" DATETIME,
    CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Answer" ("answeredAt", "id", "isCorrect", "normalized", "points", "questionId", "reviewed", "reviewedAt", "text", "userId") SELECT "answeredAt", "id", "isCorrect", "normalized", "points", "questionId", "reviewed", "reviewedAt", "text", "userId" FROM "Answer";
DROP TABLE "Answer";
ALTER TABLE "new_Answer" RENAME TO "Answer";
CREATE UNIQUE INDEX "Answer_questionId_competitionId_userId_key" ON "Answer"("questionId", "competitionId", "userId");
CREATE TABLE "new_Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "text" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'FREETEXT',
    "imageUrl" TEXT,
    "options" TEXT,
    "correctAnswer" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 1,
    "scoringType" TEXT NOT NULL DEFAULT 'ALL_EQUAL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Question" ("correctAnswer", "createdAt", "id", "imageUrl", "options", "points", "scoringType", "text", "type") SELECT "correctAnswer", "createdAt", "id", "imageUrl", "options", "points", "scoringType", "text", "type" FROM "Question";
DROP TABLE "Question";
ALTER TABLE "new_Question" RENAME TO "Question";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "QuestionUsage_questionId_competitionId_key" ON "QuestionUsage"("questionId", "competitionId");
