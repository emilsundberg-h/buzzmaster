-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CategoryGame" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competitionId" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "timePerPlayer" INTEGER NOT NULL,
    "winnerPoints" INTEGER NOT NULL,
    "turnOrder" TEXT NOT NULL,
    "currentTurnIndex" INTEGER NOT NULL DEFAULT 0,
    "currentPlayerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "timerStartedAt" DATETIME,
    "timerPausedAt" DATETIME,
    "pausedTimeElapsed" INTEGER NOT NULL DEFAULT 0,
    "eliminatedPlayers" TEXT NOT NULL DEFAULT '[]',
    "winnerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "trophyId" TEXT,
    CONSTRAINT "CategoryGame_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CategoryGame_trophyId_fkey" FOREIGN KEY ("trophyId") REFERENCES "Trophy" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CategoryGame" ("categoryName", "competitionId", "completedAt", "createdAt", "currentPlayerId", "currentTurnIndex", "eliminatedPlayers", "id", "isPaused", "pausedTimeElapsed", "startedAt", "status", "timePerPlayer", "timerPausedAt", "timerStartedAt", "trophyId", "turnOrder", "winnerId", "winnerPoints") SELECT "categoryName", "competitionId", "completedAt", "createdAt", "currentPlayerId", "currentTurnIndex", "eliminatedPlayers", "id", "isPaused", "pausedTimeElapsed", "startedAt", "status", "timePerPlayer", "timerPausedAt", "timerStartedAt", "trophyId", "turnOrder", "winnerId", "winnerPoints" FROM "CategoryGame";
DROP TABLE "CategoryGame";
ALTER TABLE "new_CategoryGame" RENAME TO "CategoryGame";
CREATE TABLE "new_QuestionUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "roundId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "sentAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trophyId" TEXT,
    CONSTRAINT "QuestionUsage_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "QuestionUsage_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "QuestionUsage_trophyId_fkey" FOREIGN KEY ("trophyId") REFERENCES "Trophy" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_QuestionUsage" ("competitionId", "completedAt", "createdAt", "id", "questionId", "roundId", "sentAt", "status", "trophyId") SELECT "competitionId", "completedAt", "createdAt", "id", "questionId", "roundId", "sentAt", "status", "trophyId" FROM "QuestionUsage";
DROP TABLE "QuestionUsage";
ALTER TABLE "new_QuestionUsage" RENAME TO "QuestionUsage";
CREATE UNIQUE INDEX "QuestionUsage_questionId_competitionId_key" ON "QuestionUsage"("questionId", "competitionId");
CREATE TABLE "new_Round" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "competitionId" TEXT NOT NULL,
    "startedAt" DATETIME,
    "endedAt" DATETIME,
    "buttonsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "winnerUserId" TEXT,
    "hasTimer" BOOLEAN NOT NULL DEFAULT false,
    "timerDuration" INTEGER,
    "timerEndsAt" DATETIME,
    "trophyId" TEXT,
    CONSTRAINT "Round_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Round_trophyId_fkey" FOREIGN KEY ("trophyId") REFERENCES "Trophy" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Round" ("buttonsEnabled", "competitionId", "endedAt", "hasTimer", "id", "startedAt", "timerDuration", "timerEndsAt", "trophyId", "winnerUserId") SELECT "buttonsEnabled", "competitionId", "endedAt", "hasTimer", "id", "startedAt", "timerDuration", "timerEndsAt", "trophyId", "winnerUserId" FROM "Round";
DROP TABLE "Round";
ALTER TABLE "new_Round" RENAME TO "Round";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
