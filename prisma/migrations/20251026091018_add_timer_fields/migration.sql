-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    CONSTRAINT "Round_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Round" ("buttonsEnabled", "competitionId", "endedAt", "id", "startedAt", "winnerUserId") SELECT "buttonsEnabled", "competitionId", "endedAt", "id", "startedAt", "winnerUserId" FROM "Round";
DROP TABLE "Round";
ALTER TABLE "new_Round" RENAME TO "Round";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
