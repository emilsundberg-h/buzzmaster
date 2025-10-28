-- CreateTable
CREATE TABLE "CategoryGame" (
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
    CONSTRAINT "CategoryGame_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
